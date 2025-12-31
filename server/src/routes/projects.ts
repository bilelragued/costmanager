import { Router } from 'express';
import db from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all projects
router.get('/', (req, res) => {
  try {
    const status = req.query.status as string;
    let query = 'SELECT * FROM projects ORDER BY created_at DESC';
    let params: any[] = [];

    if (status) {
      query = 'SELECT * FROM projects WHERE status = ? ORDER BY created_at DESC';
      params = [status];
    }

    const projects = db.prepare(query).all(...params);
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project with summary
router.get('/:id', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get WBS summary
    const wbsSummary = db.prepare(`
      SELECT
        COUNT(*) as wbs_count,
        SUM(quantity * budgeted_unit_rate) as total_budget
      FROM wbs_items
      WHERE project_id = ?
    `).get(req.params.id) as any;

    // Get variations summary
    const variationsSummary = db.prepare(`
      SELECT
        COUNT(*) as count,
        SUM(CASE WHEN status = 'approved' THEN approved_value ELSE 0 END) as approved_value,
        SUM(CASE WHEN status IN ('submitted', 'draft') THEN claimed_value ELSE 0 END) as pending_value
      FROM variations
      WHERE project_id = ?
    `).get(req.params.id) as any;

    // Get claims summary
    const claimsSummary = db.prepare(`
      SELECT
        COUNT(*) as count,
        SUM(CASE WHEN status = 'paid' THEN certified_amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN status IN ('submitted', 'certified') THEN this_claim ELSE 0 END) as outstanding_amount
      FROM progress_claims
      WHERE project_id = ?
    `).get(req.params.id) as any;

    res.json({
      ...project,
      summary: {
        wbs: wbsSummary,
        variations: variationsSummary,
        claims: claimsSummary
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create project
router.post('/', (req, res) => {
  try {
    const id = uuidv4();
    const {
      code,
      name,
      client,
      status = 'tender',
      start_date,
      end_date,
      contract_value = 0,
      retention_percent = 5,
      payment_terms_days = 30,
      contingency_percent = 5,
      overhead_percent = 8,
      margin_percent = 6
    } = req.body;

    const stmt = db.prepare(`
      INSERT INTO projects (
        id, code, name, client, status, start_date, end_date,
        contract_value, retention_percent, payment_terms_days,
        contingency_percent, overhead_percent, margin_percent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, code, name, client, status, start_date, end_date,
      contract_value, retention_percent, payment_terms_days,
      contingency_percent, overhead_percent, margin_percent
    );

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.status(201).json(project);
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Project code already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create project' });
    }
  }
});

// Update project
router.put('/:id', (req, res) => {
  try {
    const {
      code,
      name,
      client,
      status,
      start_date,
      end_date,
      contract_value,
      retention_percent,
      payment_terms_days,
      contingency_percent,
      overhead_percent,
      margin_percent
    } = req.body;

    const stmt = db.prepare(`
      UPDATE projects SET
        code = COALESCE(?, code),
        name = COALESCE(?, name),
        client = COALESCE(?, client),
        status = COALESCE(?, status),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        contract_value = COALESCE(?, contract_value),
        retention_percent = COALESCE(?, retention_percent),
        payment_terms_days = COALESCE(?, payment_terms_days),
        contingency_percent = COALESCE(?, contingency_percent),
        overhead_percent = COALESCE(?, overhead_percent),
        margin_percent = COALESCE(?, margin_percent),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      code, name, client, status, start_date, end_date,
      contract_value, retention_percent, payment_terms_days,
      contingency_percent, overhead_percent, margin_percent,
      req.params.id
    );

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Convert tender to project
router.post('/:id/convert-to-project', (req, res) => {
  try {
    const tender = db.prepare('SELECT * FROM projects WHERE id = ? AND status = ?').get(req.params.id, 'tender') as any;

    if (!tender) {
      return res.status(404).json({ error: 'Tender not found' });
    }

    // Calculate contract value from WBS
    const wbsTotal = db.prepare(`
      SELECT SUM(quantity * schedule_of_rates_rate) as total
      FROM wbs_items
      WHERE project_id = ? AND is_payment_milestone = 1
    `).get(req.params.id) as any;

    const contractValue = wbsTotal?.total || tender.contract_value;

    const stmt = db.prepare(`
      UPDATE projects SET
        status = 'active',
        contract_value = ?,
        original_tender_id = id,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(contractValue, req.params.id);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to convert tender' });
  }
});

// Clone project/tender
router.post('/:id/clone', (req, res) => {
  try {
    const source = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any;

    if (!source) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const newId = uuidv4();
    const { code, name } = req.body;

    // Clone project
    const cloneProject = db.prepare(`
      INSERT INTO projects (
        id, code, name, client, status,
        retention_percent, payment_terms_days,
        contingency_percent, overhead_percent, margin_percent
      ) VALUES (?, ?, ?, ?, 'tender', ?, ?, ?, ?, ?)
    `);

    cloneProject.run(
      newId,
      code || `${source.code}-COPY`,
      name || `${source.name} (Copy)`,
      source.client,
      source.retention_percent,
      source.payment_terms_days,
      source.contingency_percent,
      source.overhead_percent,
      source.margin_percent
    );

    // Clone WBS items
    const wbsItems = db.prepare('SELECT * FROM wbs_items WHERE project_id = ?').all(req.params.id) as any[];
    const wbsIdMap = new Map<string, string>();

    for (const item of wbsItems) {
      const newWbsId = uuidv4();
      wbsIdMap.set(item.id, newWbsId);

      db.prepare(`
        INSERT INTO wbs_items (
          id, project_id, parent_id, code, name, description, level, sort_order,
          quantity, unit, budgeted_unit_rate, duration_days,
          is_payment_milestone, payment_percent, schedule_of_rates_rate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newWbsId,
        newId,
        item.parent_id ? wbsIdMap.get(item.parent_id) : null,
        item.code,
        item.name,
        item.description,
        item.level,
        item.sort_order,
        item.quantity,
        item.unit,
        item.budgeted_unit_rate,
        item.duration_days,
        item.is_payment_milestone,
        item.payment_percent,
        item.schedule_of_rates_rate
      );

      // Clone resource assignments
      const plantAssignments = db.prepare('SELECT * FROM wbs_plant_assignments WHERE wbs_item_id = ?').all(item.id);
      for (const pa of plantAssignments as any[]) {
        db.prepare(`
          INSERT INTO wbs_plant_assignments (id, wbs_item_id, plant_type_id, budgeted_hours, hourly_rate)
          VALUES (?, ?, ?, ?, ?)
        `).run(uuidv4(), newWbsId, pa.plant_type_id, pa.budgeted_hours, pa.hourly_rate);
      }

      const labourAssignments = db.prepare('SELECT * FROM wbs_labour_assignments WHERE wbs_item_id = ?').all(item.id);
      for (const la of labourAssignments as any[]) {
        db.prepare(`
          INSERT INTO wbs_labour_assignments (id, wbs_item_id, labour_type_id, budgeted_hours, hourly_rate, quantity)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), newWbsId, la.labour_type_id, la.budgeted_hours, la.hourly_rate, la.quantity);
      }

      const materialAssignments = db.prepare('SELECT * FROM wbs_material_assignments WHERE wbs_item_id = ?').all(item.id);
      for (const ma of materialAssignments as any[]) {
        db.prepare(`
          INSERT INTO wbs_material_assignments (id, wbs_item_id, material_type_id, budgeted_quantity, unit_rate)
          VALUES (?, ?, ?, ?, ?)
        `).run(uuidv4(), newWbsId, ma.material_type_id, ma.budgeted_quantity, ma.unit_rate);
      }

      const subconAssignments = db.prepare('SELECT * FROM wbs_subcontractor_assignments WHERE wbs_item_id = ?').all(item.id);
      for (const sa of subconAssignments as any[]) {
        db.prepare(`
          INSERT INTO wbs_subcontractor_assignments (id, wbs_item_id, subcontractor_type_id, description, budgeted_value)
          VALUES (?, ?, ?, ?, ?)
        `).run(uuidv4(), newWbsId, sa.subcontractor_type_id, sa.description, sa.budgeted_value);
      }
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(newId);
    res.status(201).json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to clone project' });
  }
});

// Delete project
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
