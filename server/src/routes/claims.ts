import { Router } from 'express';
import db from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all claims for a project
router.get('/project/:projectId', (req, res) => {
  try {
    const claims = db.prepare(`
      SELECT * FROM progress_claims
      WHERE project_id = ?
      ORDER BY claim_number DESC
    `).all(req.params.projectId);

    res.json(claims);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

// Get single claim with line items
router.get('/:id', (req, res) => {
  try {
    const claim = db.prepare('SELECT * FROM progress_claims WHERE id = ?').get(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    const lineItems = db.prepare(`
      SELECT cli.*, w.code as wbs_code, w.name as wbs_name, w.unit
      FROM claim_line_items cli
      JOIN wbs_items w ON cli.wbs_item_id = w.id
      WHERE cli.claim_id = ?
      ORDER BY w.sort_order, w.code
    `).all(req.params.id);

    res.json({ ...claim, line_items: lineItems });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
});

// Create new claim
router.post('/', (req, res) => {
  try {
    const id = uuidv4();
    const { project_id, claim_period_start, claim_period_end } = req.body;

    // Get project and settings
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id) as any;
    const settings = db.prepare('SELECT * FROM company_settings WHERE id = ?').get('default') as any;

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get next claim number
    const lastClaim = db.prepare(`
      SELECT MAX(claim_number) as max_num FROM progress_claims WHERE project_id = ?
    `).get(project_id) as any;

    const claimNumber = (lastClaim?.max_num || 0) + 1;

    // Get previous claims total
    const previousClaims = db.prepare(`
      SELECT COALESCE(SUM(this_claim), 0) as total
      FROM progress_claims
      WHERE project_id = ? AND status IN ('submitted', 'certified', 'paid')
    `).get(project_id) as any;

    // Create claim
    db.prepare(`
      INSERT INTO progress_claims (
        id, project_id, claim_number, claim_period_start, claim_period_end,
        previous_claims, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'draft')
    `).run(id, project_id, claimNumber, claim_period_start, claim_period_end, previousClaims.total);

    // Get WBS items that are payment milestones
    const wbsItems = db.prepare(`
      SELECT * FROM wbs_items
      WHERE project_id = ? AND is_payment_milestone = 1
      ORDER BY sort_order, code
    `).all(project_id) as any[];

    // Get previous quantities claimed per WBS
    const previousQtys = db.prepare(`
      SELECT wbs_item_id, SUM(this_quantity) as prev_qty
      FROM claim_line_items cli
      JOIN progress_claims pc ON cli.claim_id = pc.id
      WHERE pc.project_id = ? AND pc.id != ? AND pc.status IN ('submitted', 'certified', 'paid')
      GROUP BY wbs_item_id
    `).all(project_id, id) as any[];

    const prevQtyMap = new Map(previousQtys.map(p => [p.wbs_item_id, p.prev_qty]));

    // Get quantities completed from daily logs
    const completedQtys = db.prepare(`
      SELECT wbs_item_id, SUM(quantity_completed) as completed
      FROM actual_quantities aq
      JOIN daily_logs dl ON aq.daily_log_id = dl.id
      WHERE dl.project_id = ?
      GROUP BY wbs_item_id
    `).all(project_id) as any[];

    const completedMap = new Map(completedQtys.map(c => [c.wbs_item_id, c.completed]));

    // Create line items
    for (const wbs of wbsItems) {
      const previousQty = prevQtyMap.get(wbs.id) || 0;
      const completed = completedMap.get(wbs.id) || 0;
      const thisQty = Math.max(0, completed - previousQty);
      const toDateQty = previousQty + thisQty;
      const rate = wbs.schedule_of_rates_rate || 0;
      const thisValue = thisQty * rate;

      db.prepare(`
        INSERT INTO claim_line_items (
          id, claim_id, wbs_item_id, contract_quantity, previous_quantity,
          this_quantity, to_date_quantity, rate, this_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), id, wbs.id, wbs.quantity, previousQty, thisQty, toDateQty, rate, thisValue);
    }

    // Calculate totals
    const totals = db.prepare(`
      SELECT SUM(this_value) as gross_amount
      FROM claim_line_items
      WHERE claim_id = ?
    `).get(id) as any;

    const grossAmount = totals.gross_amount || 0;
    const retentionHeld = grossAmount * (project.retention_percent / 100);
    const thisClaim = grossAmount - retentionHeld;
    const gstAmount = thisClaim * (settings.gst_rate || 0.15);
    const totalInvoice = thisClaim + gstAmount;

    db.prepare(`
      UPDATE progress_claims SET
        gross_amount = ?,
        retention_held = ?,
        this_claim = ?,
        gst_amount = ?,
        total_invoice = ?
      WHERE id = ?
    `).run(grossAmount, retentionHeld, thisClaim, gstAmount, totalInvoice, id);

    // Return complete claim
    const claim = db.prepare('SELECT * FROM progress_claims WHERE id = ?').get(id);
    const lineItems = db.prepare(`
      SELECT cli.*, w.code as wbs_code, w.name as wbs_name, w.unit
      FROM claim_line_items cli
      JOIN wbs_items w ON cli.wbs_item_id = w.id
      WHERE cli.claim_id = ?
    `).all(id);

    res.status(201).json({ ...claim, line_items: lineItems });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create claim' });
  }
});

// Update claim line item
router.put('/line-item/:id', (req, res) => {
  try {
    const { this_quantity, rate } = req.body;

    const item = db.prepare('SELECT * FROM claim_line_items WHERE id = ?').get(req.params.id) as any;
    if (!item) {
      return res.status(404).json({ error: 'Line item not found' });
    }

    const newQty = this_quantity !== undefined ? this_quantity : item.this_quantity;
    const newRate = rate !== undefined ? rate : item.rate;
    const toDateQty = item.previous_quantity + newQty;
    const thisValue = newQty * newRate;

    db.prepare(`
      UPDATE claim_line_items SET
        this_quantity = ?,
        to_date_quantity = ?,
        rate = ?,
        this_value = ?
      WHERE id = ?
    `).run(newQty, toDateQty, newRate, thisValue, req.params.id);

    // Recalculate claim totals
    const claim = db.prepare('SELECT * FROM progress_claims WHERE id = ?').get(item.claim_id) as any;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(claim.project_id) as any;
    const settings = db.prepare('SELECT * FROM company_settings WHERE id = ?').get('default') as any;

    const totals = db.prepare(`
      SELECT SUM(this_value) as gross_amount
      FROM claim_line_items
      WHERE claim_id = ?
    `).get(item.claim_id) as any;

    const grossAmount = totals.gross_amount || 0;
    const retentionHeld = grossAmount * (project.retention_percent / 100);
    const thisClaim = grossAmount - retentionHeld;
    const gstAmount = thisClaim * (settings.gst_rate || 0.15);
    const totalInvoice = thisClaim + gstAmount;

    db.prepare(`
      UPDATE progress_claims SET
        gross_amount = ?,
        retention_held = ?,
        this_claim = ?,
        gst_amount = ?,
        total_invoice = ?
      WHERE id = ?
    `).run(grossAmount, retentionHeld, thisClaim, gstAmount, totalInvoice, item.claim_id);

    const updatedItem = db.prepare('SELECT * FROM claim_line_items WHERE id = ?').get(req.params.id);
    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update line item' });
  }
});

// Update claim status
router.put('/:id', (req, res) => {
  try {
    const { status, submitted_date, certified_date, paid_date, certified_amount, notes } = req.body;

    db.prepare(`
      UPDATE progress_claims SET
        status = COALESCE(?, status),
        submitted_date = COALESCE(?, submitted_date),
        certified_date = COALESCE(?, certified_date),
        paid_date = COALESCE(?, paid_date),
        certified_amount = COALESCE(?, certified_amount),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, submitted_date, certified_date, paid_date, certified_amount, notes, req.params.id);

    const claim = db.prepare('SELECT * FROM progress_claims WHERE id = ?').get(req.params.id);
    res.json(claim);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update claim' });
  }
});

// Delete claim
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM progress_claims WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete claim' });
  }
});

// Revenue summary for project
router.get('/summary/:projectId', (req, res) => {
  try {
    const projectId = req.params.projectId;

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;

    // Contract value from WBS
    const contractValue = db.prepare(`
      SELECT COALESCE(SUM(quantity * schedule_of_rates_rate), 0) as total
      FROM wbs_items
      WHERE project_id = ? AND is_payment_milestone = 1
    `).get(projectId) as any;

    // Variations
    const variations = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'approved' THEN approved_value ELSE 0 END), 0) as approved,
        COALESCE(SUM(CASE WHEN status IN ('draft', 'submitted') THEN claimed_value ELSE 0 END), 0) as pending
      FROM variations
      WHERE project_id = ?
    `).get(projectId) as any;

    // Claims
    const claims = db.prepare(`
      SELECT
        COALESCE(SUM(this_claim), 0) as total_claimed,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN certified_amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN status IN ('submitted', 'certified') THEN this_claim ELSE 0 END), 0) as outstanding,
        COALESCE(SUM(retention_held), 0) as retention_held
      FROM progress_claims
      WHERE project_id = ? AND status != 'draft'
    `).get(projectId) as any;

    const originalContract = contractValue.total || project.contract_value || 0;
    const revisedContract = originalContract + variations.approved;

    res.json({
      original_contract: originalContract,
      approved_variations: variations.approved,
      pending_variations: variations.pending,
      revised_contract: revisedContract,
      claimed: claims.total_claimed,
      certified: claims.total_paid,
      outstanding: claims.outstanding,
      retention_held: claims.retention_held,
      remaining_to_claim: revisedContract - claims.total_claimed
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get revenue summary' });
  }
});

export default router;
