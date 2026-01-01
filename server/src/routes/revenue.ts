import { Router } from 'express';
import db from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================================
// REVENUE ITEMS - Schedule of Prices / Pay Items
// ============================================================

// Get all revenue items for a project
router.get('/project/:projectId', (req, res) => {
  try {
    const items = db.prepare(`
      SELECT ri.*,
        (SELECT COUNT(*) FROM programme_revenue_mappings WHERE revenue_item_id = ri.id) as programme_mapping_count,
        (SELECT COUNT(*) FROM wbs_revenue_mappings WHERE revenue_item_id = ri.id) as wbs_mapping_count
      FROM revenue_items ri
      WHERE ri.project_id = ?
      ORDER BY ri.sort_order, ri.code
    `).all(req.params.projectId);

    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch revenue items' });
  }
});

// Get single revenue item with all mappings
router.get('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM revenue_items WHERE id = ?').get(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Revenue item not found' });
    }

    // Get programme mappings
    const programmeMappings = db.prepare(`
      SELECT prm.*, pt.code as task_code, pt.name as task_name, pt.start_date, pt.end_date
      FROM programme_revenue_mappings prm
      JOIN programme_tasks pt ON prm.programme_task_id = pt.id
      WHERE prm.revenue_item_id = ?
    `).all(req.params.id);

    // Get WBS mappings
    const wbsMappings = db.prepare(`
      SELECT wrm.*, w.code as wbs_code, w.name as wbs_name, w.total_cost
      FROM wbs_revenue_mappings wrm
      JOIN wbs_items w ON wrm.wbs_item_id = w.id
      WHERE wrm.revenue_item_id = ?
    `).all(req.params.id);

    res.json({
      ...item,
      programme_mappings: programmeMappings,
      wbs_mappings: wbsMappings
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch revenue item' });
  }
});

// Create revenue item
router.post('/', (req, res) => {
  try {
    const id = uuidv4();
    const {
      project_id,
      code,
      name,
      description,
      parent_id,
      level = 1,
      sort_order = 0,
      unit,
      contract_quantity = 0,
      contract_rate = 0,
      contract_value = 0,
      payment_milestone = 0,
      payment_percent = 0,
      notes
    } = req.body;

    db.prepare(`
      INSERT INTO revenue_items (
        id, project_id, code, name, description, parent_id, level, sort_order,
        unit, contract_quantity, contract_rate, contract_value,
        payment_milestone, payment_percent, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, project_id, code, name, description, parent_id, level, sort_order,
      unit, contract_quantity, contract_rate, contract_value,
      payment_milestone, payment_percent, notes
    );

    const item = db.prepare('SELECT * FROM revenue_items WHERE id = ?').get(id);
    res.status(201).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create revenue item' });
  }
});

// Update revenue item
router.put('/:id', (req, res) => {
  try {
    const {
      code,
      name,
      description,
      parent_id,
      level,
      sort_order,
      unit,
      contract_quantity,
      contract_rate,
      contract_value,
      payment_milestone,
      payment_percent,
      notes
    } = req.body;

    db.prepare(`
      UPDATE revenue_items
      SET code = ?, name = ?, description = ?, parent_id = ?, level = ?, sort_order = ?,
          unit = ?, contract_quantity = ?, contract_rate = ?, contract_value = ?,
          payment_milestone = ?, payment_percent = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      code, name, description, parent_id, level, sort_order,
      unit, contract_quantity, contract_rate, contract_value,
      payment_milestone, payment_percent, notes,
      req.params.id
    );

    const item = db.prepare('SELECT * FROM revenue_items WHERE id = ?').get(req.params.id);
    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update revenue item' });
  }
});

// Delete revenue item
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM revenue_items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete revenue item' });
  }
});

// Import revenue items from WBS payment milestones
router.post('/import-from-wbs/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;

    // Get all WBS items marked as payment milestones
    const paymentMilestones = db.prepare(`
      SELECT * FROM wbs_items
      WHERE project_id = ? AND is_payment_milestone = 1
      ORDER BY code
    `).all(projectId) as Array<{
      id: string;
      code: string;
      name: string;
      description: string;
      unit: string;
      quantity: number;
      schedule_of_rates_rate: number;
    }>;

    const createdItems = [];

    for (const wbs of paymentMilestones) {
      const id = uuidv4();

      // Calculate contract value from WBS
      const contractValue = (wbs.quantity || 0) * (wbs.schedule_of_rates_rate || 0);

      db.prepare(`
        INSERT INTO revenue_items (
          id, project_id, code, name, description, unit,
          contract_quantity, contract_rate, contract_value,
          payment_milestone, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        projectId,
        `REV-${wbs.code}`,
        wbs.name,
        wbs.description,
        wbs.unit,
        wbs.quantity,
        wbs.schedule_of_rates_rate,
        contractValue,
        1,
        `Imported from WBS ${wbs.code}`
      );

      // Create automatic 1:1 WBS → Revenue mapping
      db.prepare(`
        INSERT INTO wbs_revenue_mappings (
          id, project_id, wbs_item_id, revenue_item_id,
          allocation_type, allocation_percent, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        projectId,
        wbs.id,
        id,
        'percent',
        100,
        `Auto-mapped from import: WBS ${wbs.code}`
      );

      const item = db.prepare('SELECT * FROM revenue_items WHERE id = ?').get(id);
      createdItems.push(item);
    }

    res.json({
      created: createdItems.length,
      items: createdItems
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to import revenue items' });
  }
});

export default router;
