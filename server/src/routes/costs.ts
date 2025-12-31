import { Router } from 'express';
import db from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============ DAILY LOGS ============

// Get daily logs for a project
router.get('/daily-logs/:projectId', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT * FROM daily_logs
      WHERE project_id = ?
      ORDER BY log_date DESC
    `).all(req.params.projectId);

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch daily logs' });
  }
});

// Get single daily log with all entries
router.get('/daily-log/:id', (req, res) => {
  try {
    const log = db.prepare('SELECT * FROM daily_logs WHERE id = ?').get(req.params.id);

    if (!log) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    const plantHours = db.prepare(`
      SELECT aph.*, w.code as wbs_code, w.name as wbs_name, pt.code as plant_code, pt.description as plant_description
      FROM actual_plant_hours aph
      JOIN wbs_items w ON aph.wbs_item_id = w.id
      JOIN plant_types pt ON aph.plant_type_id = pt.id
      WHERE aph.daily_log_id = ?
    `).all(req.params.id);

    const labourHours = db.prepare(`
      SELECT alh.*, w.code as wbs_code, w.name as wbs_name, lt.code as labour_code, lt.role as labour_role
      FROM actual_labour_hours alh
      JOIN wbs_items w ON alh.wbs_item_id = w.id
      JOIN labour_types lt ON alh.labour_type_id = lt.id
      WHERE alh.daily_log_id = ?
    `).all(req.params.id);

    const materials = db.prepare(`
      SELECT am.*, w.code as wbs_code, w.name as wbs_name, mt.code as material_code, mt.description as material_description
      FROM actual_materials am
      JOIN wbs_items w ON am.wbs_item_id = w.id
      JOIN material_types mt ON am.material_type_id = mt.id
      WHERE am.daily_log_id = ?
    `).all(req.params.id);

    const quantities = db.prepare(`
      SELECT aq.*, w.code as wbs_code, w.name as wbs_name, w.unit
      FROM actual_quantities aq
      JOIN wbs_items w ON aq.wbs_item_id = w.id
      WHERE aq.daily_log_id = ?
    `).all(req.params.id);

    res.json({
      ...log,
      plant_hours: plantHours,
      labour_hours: labourHours,
      materials,
      quantities
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch daily log' });
  }
});

// Create daily log
router.post('/daily-logs', (req, res) => {
  try {
    const id = uuidv4();
    const { project_id, log_date, weather, notes } = req.body;

    // Check if log already exists for this date
    const existing = db.prepare('SELECT id FROM daily_logs WHERE project_id = ? AND log_date = ?').get(project_id, log_date);
    if (existing) {
      return res.status(400).json({ error: 'Daily log already exists for this date' });
    }

    db.prepare(`
      INSERT INTO daily_logs (id, project_id, log_date, weather, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, project_id, log_date, weather, notes);

    const log = db.prepare('SELECT * FROM daily_logs WHERE id = ?').get(id);
    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create daily log' });
  }
});

// Add plant hours
router.post('/daily-log/:logId/plant', (req, res) => {
  try {
    const id = uuidv4();
    const { wbs_item_id, plant_type_id, hours, notes } = req.body;

    db.prepare(`
      INSERT INTO actual_plant_hours (id, daily_log_id, wbs_item_id, plant_type_id, hours, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.params.logId, wbs_item_id, plant_type_id, hours || 0, notes);

    const entry = db.prepare(`
      SELECT aph.*, w.code as wbs_code, pt.code as plant_code
      FROM actual_plant_hours aph
      JOIN wbs_items w ON aph.wbs_item_id = w.id
      JOIN plant_types pt ON aph.plant_type_id = pt.id
      WHERE aph.id = ?
    `).get(id);

    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add plant hours' });
  }
});

// Add labour hours
router.post('/daily-log/:logId/labour', (req, res) => {
  try {
    const id = uuidv4();
    const { wbs_item_id, labour_type_id, hours, workers, notes } = req.body;

    db.prepare(`
      INSERT INTO actual_labour_hours (id, daily_log_id, wbs_item_id, labour_type_id, hours, workers, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.logId, wbs_item_id, labour_type_id, hours || 0, workers || 1, notes);

    const entry = db.prepare(`
      SELECT alh.*, w.code as wbs_code, lt.code as labour_code
      FROM actual_labour_hours alh
      JOIN wbs_items w ON alh.wbs_item_id = w.id
      JOIN labour_types lt ON alh.labour_type_id = lt.id
      WHERE alh.id = ?
    `).get(id);

    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add labour hours' });
  }
});

// Add material delivery
router.post('/daily-log/:logId/material', (req, res) => {
  try {
    const id = uuidv4();
    const { wbs_item_id, material_type_id, quantity, unit_cost, docket_number, notes } = req.body;

    db.prepare(`
      INSERT INTO actual_materials (id, daily_log_id, wbs_item_id, material_type_id, quantity, unit_cost, docket_number, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.logId, wbs_item_id, material_type_id, quantity || 0, unit_cost || 0, docket_number, notes);

    const entry = db.prepare('SELECT * FROM actual_materials WHERE id = ?').get(id);
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add material delivery' });
  }
});

// Add quantity completed
router.post('/daily-log/:logId/quantity', (req, res) => {
  try {
    const id = uuidv4();
    const { wbs_item_id, quantity_completed, notes } = req.body;

    db.prepare(`
      INSERT INTO actual_quantities (id, daily_log_id, wbs_item_id, quantity_completed, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, req.params.logId, wbs_item_id, quantity_completed || 0, notes);

    const entry = db.prepare('SELECT * FROM actual_quantities WHERE id = ?').get(id);
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add quantity' });
  }
});

// ============ COST ENTRIES (INVOICES) ============

router.get('/entries/:projectId', (req, res) => {
  try {
    const entries = db.prepare(`
      SELECT ce.*, w.code as wbs_code, w.name as wbs_name
      FROM cost_entries ce
      LEFT JOIN wbs_items w ON ce.wbs_item_id = w.id
      WHERE ce.project_id = ?
      ORDER BY ce.invoice_date DESC
    `).all(req.params.projectId);

    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cost entries' });
  }
});

router.post('/entries', (req, res) => {
  try {
    const id = uuidv4();
    const {
      project_id,
      wbs_item_id,
      cost_type,
      description,
      invoice_number,
      invoice_date,
      amount,
      payment_due_date,
      status = 'pending'
    } = req.body;

    db.prepare(`
      INSERT INTO cost_entries (
        id, project_id, wbs_item_id, cost_type, description,
        invoice_number, invoice_date, amount, payment_due_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, project_id, wbs_item_id, cost_type, description, invoice_number, invoice_date, amount || 0, payment_due_date, status);

    const entry = db.prepare('SELECT * FROM cost_entries WHERE id = ?').get(id);
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create cost entry' });
  }
});

router.put('/entries/:id', (req, res) => {
  try {
    const { status, payment_date, amount } = req.body;

    db.prepare(`
      UPDATE cost_entries SET
        status = COALESCE(?, status),
        payment_date = COALESCE(?, payment_date),
        amount = COALESCE(?, amount),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, payment_date, amount, req.params.id);

    const entry = db.prepare('SELECT * FROM cost_entries WHERE id = ?').get(req.params.id);
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cost entry' });
  }
});

// ============ VARIATIONS ============

router.get('/variations/:projectId', (req, res) => {
  try {
    const variations = db.prepare(`
      SELECT * FROM variations
      WHERE project_id = ?
      ORDER BY variation_number
    `).all(req.params.projectId);

    res.json(variations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch variations' });
  }
});

router.post('/variations', (req, res) => {
  try {
    const id = uuidv4();
    const { project_id, description, claimed_value, cost_impact, notes } = req.body;

    // Get next variation number
    const lastVar = db.prepare(`
      SELECT MAX(variation_number) as max_num FROM variations WHERE project_id = ?
    `).get(project_id) as any;

    const variationNumber = (lastVar?.max_num || 0) + 1;

    db.prepare(`
      INSERT INTO variations (id, project_id, variation_number, description, claimed_value, cost_impact, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, project_id, variationNumber, description, claimed_value || 0, cost_impact || 0, notes);

    const variation = db.prepare('SELECT * FROM variations WHERE id = ?').get(id);
    res.status(201).json(variation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create variation' });
  }
});

router.put('/variations/:id', (req, res) => {
  try {
    const { status, claimed_value, approved_value, cost_impact, submitted_date, approved_date, notes } = req.body;

    db.prepare(`
      UPDATE variations SET
        status = COALESCE(?, status),
        claimed_value = COALESCE(?, claimed_value),
        approved_value = COALESCE(?, approved_value),
        cost_impact = COALESCE(?, cost_impact),
        submitted_date = COALESCE(?, submitted_date),
        approved_date = COALESCE(?, approved_date),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, claimed_value, approved_value, cost_impact, submitted_date, approved_date, notes, req.params.id);

    const variation = db.prepare('SELECT * FROM variations WHERE id = ?').get(req.params.id);
    res.json(variation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update variation' });
  }
});

// ============ COST SUMMARY ============

router.get('/summary/:projectId', (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Get project
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;

    // Budget from WBS
    const wbsBudget = db.prepare(`
      SELECT
        COALESCE(SUM(
          (SELECT COALESCE(SUM(budgeted_hours * hourly_rate), 0) FROM wbs_plant_assignments WHERE wbs_item_id = w.id) +
          (SELECT COALESCE(SUM(budgeted_hours * hourly_rate * quantity), 0) FROM wbs_labour_assignments WHERE wbs_item_id = w.id) +
          (SELECT COALESCE(SUM(budgeted_quantity * unit_rate), 0) FROM wbs_material_assignments WHERE wbs_item_id = w.id) +
          (SELECT COALESCE(SUM(budgeted_value), 0) FROM wbs_subcontractor_assignments WHERE wbs_item_id = w.id)
        ), 0) as direct_cost,
        COALESCE(SUM(quantity * schedule_of_rates_rate), 0) as contract_value
      FROM wbs_items w
      WHERE w.project_id = ? AND w.is_payment_milestone = 1
    `).get(projectId) as any;

    // Actuals from daily logs
    const plantActuals = db.prepare(`
      SELECT COALESCE(SUM(aph.hours * pt.hourly_rate), 0) as total
      FROM actual_plant_hours aph
      JOIN daily_logs dl ON aph.daily_log_id = dl.id
      JOIN plant_types pt ON aph.plant_type_id = pt.id
      WHERE dl.project_id = ?
    `).get(projectId) as any;

    const labourActuals = db.prepare(`
      SELECT COALESCE(SUM(alh.hours * alh.workers * lt.hourly_rate), 0) as total
      FROM actual_labour_hours alh
      JOIN daily_logs dl ON alh.daily_log_id = dl.id
      JOIN labour_types lt ON alh.labour_type_id = lt.id
      WHERE dl.project_id = ?
    `).get(projectId) as any;

    const materialActuals = db.prepare(`
      SELECT COALESCE(SUM(am.quantity * am.unit_cost), 0) as total
      FROM actual_materials am
      JOIN daily_logs dl ON am.daily_log_id = dl.id
      WHERE dl.project_id = ?
    `).get(projectId) as any;

    // Cost entries (invoices)
    const costEntries = db.prepare(`
      SELECT
        cost_type,
        COALESCE(SUM(amount), 0) as total
      FROM cost_entries
      WHERE project_id = ?
      GROUP BY cost_type
    `).all(projectId) as any[];

    const costEntriesMap = new Map(costEntries.map(c => [c.cost_type, c.total]));

    // Committed costs
    const committed = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM cost_entries
      WHERE project_id = ? AND status IN ('pending', 'approved')
    `).get(projectId) as any;

    // Variations
    const variations = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'approved' THEN approved_value ELSE 0 END), 0) as approved_revenue,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN cost_impact ELSE 0 END), 0) as approved_cost
      FROM variations
      WHERE project_id = ?
    `).get(projectId) as any;

    // Progress - quantities completed
    const progress = db.prepare(`
      SELECT
        w.id,
        w.quantity as budget_qty,
        COALESCE(SUM(aq.quantity_completed), 0) as completed_qty
      FROM wbs_items w
      LEFT JOIN actual_quantities aq ON w.id = aq.wbs_item_id
      WHERE w.project_id = ? AND w.quantity > 0
      GROUP BY w.id
    `).all(projectId) as any[];

    const totalBudgetQty = progress.reduce((sum, p) => sum + p.budget_qty, 0);
    const totalCompletedQty = progress.reduce((sum, p) => sum + p.completed_qty, 0);
    const percentComplete = totalBudgetQty > 0 ? (totalCompletedQty / totalBudgetQty) * 100 : 0;

    // Calculate totals
    const actualPlant = plantActuals.total + (costEntriesMap.get('plant') || 0);
    const actualLabour = labourActuals.total + (costEntriesMap.get('labour') || 0);
    const actualMaterial = materialActuals.total + (costEntriesMap.get('material') || 0);
    const actualSubcontractor = costEntriesMap.get('subcontractor') || 0;
    const actualOther = costEntriesMap.get('other') || 0;
    const totalActuals = actualPlant + actualLabour + actualMaterial + actualSubcontractor + actualOther;

    // Earned Value calculations
    const directCostBudget = wbsBudget.direct_cost || 0;
    const earnedValue = directCostBudget * (percentComplete / 100);
    const cpi = totalActuals > 0 ? earnedValue / totalActuals : 1;
    const forecastAtCompletion = cpi > 0 ? directCostBudget / cpi : directCostBudget;

    // Contract value
    const originalContract = wbsBudget.contract_value || project.contract_value || 0;
    const revisedContract = originalContract + (variations.approved_revenue || 0);

    // Add overhead, contingency
    const contingency = directCostBudget * (project.contingency_percent / 100);
    const overhead = directCostBudget * (project.overhead_percent / 100);
    const totalBudget = directCostBudget + contingency + overhead;

    res.json({
      budget: {
        direct_cost: directCostBudget,
        contingency,
        overhead,
        total: totalBudget
      },
      actuals: {
        plant: actualPlant,
        labour: actualLabour,
        material: actualMaterial,
        subcontractor: actualSubcontractor,
        other: actualOther,
        total: totalActuals
      },
      committed: committed.total,
      forecast: {
        at_completion: forecastAtCompletion,
        variance: directCostBudget - forecastAtCompletion
      },
      revenue: {
        original_contract: originalContract,
        approved_variations: variations.approved_revenue,
        revised_contract: revisedContract
      },
      margin: {
        budget: originalContract - totalBudget,
        budget_percent: originalContract > 0 ? ((originalContract - totalBudget) / originalContract) * 100 : 0,
        forecast: revisedContract - forecastAtCompletion,
        forecast_percent: revisedContract > 0 ? ((revisedContract - forecastAtCompletion) / revisedContract) * 100 : 0
      },
      progress: {
        percent_complete: percentComplete,
        earned_value: earnedValue,
        cpi,
        spi: 1 // Would need schedule data to calculate
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to calculate cost summary' });
  }
});

// WBS-level cost breakdown
router.get('/wbs-breakdown/:projectId', (req, res) => {
  try {
    const breakdown = db.prepare(`
      SELECT
        w.id,
        w.code,
        w.name,
        w.quantity,
        w.unit,
        -- Budget
        (SELECT COALESCE(SUM(budgeted_hours * hourly_rate), 0) FROM wbs_plant_assignments WHERE wbs_item_id = w.id) as budget_plant,
        (SELECT COALESCE(SUM(budgeted_hours * hourly_rate * quantity), 0) FROM wbs_labour_assignments WHERE wbs_item_id = w.id) as budget_labour,
        (SELECT COALESCE(SUM(budgeted_quantity * unit_rate), 0) FROM wbs_material_assignments WHERE wbs_item_id = w.id) as budget_material,
        (SELECT COALESCE(SUM(budgeted_value), 0) FROM wbs_subcontractor_assignments WHERE wbs_item_id = w.id) as budget_subcontractor,
        -- Actuals from daily logs
        (SELECT COALESCE(SUM(aph.hours * pt.hourly_rate), 0)
         FROM actual_plant_hours aph
         JOIN daily_logs dl ON aph.daily_log_id = dl.id
         JOIN plant_types pt ON aph.plant_type_id = pt.id
         WHERE aph.wbs_item_id = w.id) as actual_plant,
        (SELECT COALESCE(SUM(alh.hours * alh.workers * lt.hourly_rate), 0)
         FROM actual_labour_hours alh
         JOIN daily_logs dl ON alh.daily_log_id = dl.id
         JOIN labour_types lt ON alh.labour_type_id = lt.id
         WHERE alh.wbs_item_id = w.id) as actual_labour,
        (SELECT COALESCE(SUM(am.quantity * am.unit_cost), 0)
         FROM actual_materials am
         JOIN daily_logs dl ON am.daily_log_id = dl.id
         WHERE am.wbs_item_id = w.id) as actual_material,
        -- Cost entries
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE wbs_item_id = w.id AND cost_type = 'subcontractor') as actual_subcontractor,
        -- Quantity completed
        (SELECT COALESCE(SUM(aq.quantity_completed), 0)
         FROM actual_quantities aq
         WHERE aq.wbs_item_id = w.id) as quantity_completed
      FROM wbs_items w
      WHERE w.project_id = ?
      ORDER BY w.sort_order, w.code
    `).all(req.params.projectId);

    const result = (breakdown as any[]).map(item => {
      const budgetTotal = item.budget_plant + item.budget_labour + item.budget_material + item.budget_subcontractor;
      const actualTotal = item.actual_plant + item.actual_labour + item.actual_material + item.actual_subcontractor;
      const percentComplete = item.quantity > 0 ? (item.quantity_completed / item.quantity) * 100 : 0;

      return {
        ...item,
        budget_total: budgetTotal,
        actual_total: actualTotal,
        variance: budgetTotal - actualTotal,
        percent_complete: percentComplete
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch WBS breakdown' });
  }
});

export default router;
