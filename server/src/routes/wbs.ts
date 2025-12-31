import { Router } from 'express';
import db from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all WBS items for a project
router.get('/project/:projectId', (req, res) => {
  try {
    const wbsItems = db.prepare(`
      SELECT w.*,
        (SELECT SUM(budgeted_hours * hourly_rate) FROM wbs_plant_assignments WHERE wbs_item_id = w.id) as plant_cost,
        (SELECT SUM(budgeted_hours * hourly_rate * quantity) FROM wbs_labour_assignments WHERE wbs_item_id = w.id) as labour_cost,
        (SELECT SUM(budgeted_quantity * unit_rate) FROM wbs_material_assignments WHERE wbs_item_id = w.id) as material_cost,
        (SELECT SUM(budgeted_value) FROM wbs_subcontractor_assignments WHERE wbs_item_id = w.id) as subcontractor_cost
      FROM wbs_items w
      WHERE w.project_id = ?
      ORDER BY w.sort_order, w.code
    `).all(req.params.projectId);

    // Calculate total cost for each item
    const items = (wbsItems as any[]).map(item => ({
      ...item,
      total_cost: (item.plant_cost || 0) + (item.labour_cost || 0) + (item.material_cost || 0) + (item.subcontractor_cost || 0),
      unit_rate_calculated: item.quantity > 0
        ? ((item.plant_cost || 0) + (item.labour_cost || 0) + (item.material_cost || 0) + (item.subcontractor_cost || 0)) / item.quantity
        : 0
    }));

    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch WBS items' });
  }
});

// Get single WBS item with all assignments
router.get('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM wbs_items WHERE id = ?').get(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'WBS item not found' });
    }

    const plantAssignments = db.prepare(`
      SELECT wpa.*, pt.code as plant_code, pt.description as plant_description
      FROM wbs_plant_assignments wpa
      JOIN plant_types pt ON wpa.plant_type_id = pt.id
      WHERE wpa.wbs_item_id = ?
    `).all(req.params.id);

    const labourAssignments = db.prepare(`
      SELECT wla.*, lt.code as labour_code, lt.role as labour_role
      FROM wbs_labour_assignments wla
      JOIN labour_types lt ON wla.labour_type_id = lt.id
      WHERE wla.wbs_item_id = ?
    `).all(req.params.id);

    const materialAssignments = db.prepare(`
      SELECT wma.*, mt.code as material_code, mt.description as material_description, mt.unit as material_unit
      FROM wbs_material_assignments wma
      JOIN material_types mt ON wma.material_type_id = mt.id
      WHERE wma.wbs_item_id = ?
    `).all(req.params.id);

    const subcontractorAssignments = db.prepare(`
      SELECT wsa.*, st.code as subcontractor_code, st.trade as subcontractor_trade
      FROM wbs_subcontractor_assignments wsa
      JOIN subcontractor_types st ON wsa.subcontractor_type_id = st.id
      WHERE wsa.wbs_item_id = ?
    `).all(req.params.id);

    res.json({
      ...item,
      plant_assignments: plantAssignments,
      labour_assignments: labourAssignments,
      material_assignments: materialAssignments,
      subcontractor_assignments: subcontractorAssignments
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch WBS item' });
  }
});

// Create WBS item
router.post('/', (req, res) => {
  try {
    const id = uuidv4();
    const {
      project_id,
      parent_id,
      code,
      name,
      description,
      level = 1,
      sort_order = 0,
      quantity = 0,
      unit,
      budgeted_unit_rate = 0,
      start_date,
      end_date,
      duration_days = 0,
      predecessor_id,
      predecessor_lag_days = 0,
      is_payment_milestone = false,
      payment_percent = 0,
      schedule_of_rates_rate = 0
    } = req.body;

    db.prepare(`
      INSERT INTO wbs_items (
        id, project_id, parent_id, code, name, description, level, sort_order,
        quantity, unit, budgeted_unit_rate, start_date, end_date, duration_days,
        predecessor_id, predecessor_lag_days, is_payment_milestone, payment_percent, schedule_of_rates_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, project_id, parent_id, code, name, description, level, sort_order,
      quantity, unit, budgeted_unit_rate, start_date, end_date, duration_days,
      predecessor_id, predecessor_lag_days, is_payment_milestone ? 1 : 0, payment_percent, schedule_of_rates_rate
    );

    const item = db.prepare('SELECT * FROM wbs_items WHERE id = ?').get(id);
    res.status(201).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create WBS item' });
  }
});

// Update WBS item
router.put('/:id', (req, res) => {
  try {
    const {
      code,
      name,
      description,
      level,
      sort_order,
      quantity,
      unit,
      budgeted_unit_rate,
      start_date,
      end_date,
      duration_days,
      predecessor_id,
      predecessor_lag_days,
      is_payment_milestone,
      payment_percent,
      schedule_of_rates_rate
    } = req.body;

    db.prepare(`
      UPDATE wbs_items SET
        code = COALESCE(?, code),
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        level = COALESCE(?, level),
        sort_order = COALESCE(?, sort_order),
        quantity = COALESCE(?, quantity),
        unit = COALESCE(?, unit),
        budgeted_unit_rate = COALESCE(?, budgeted_unit_rate),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        duration_days = COALESCE(?, duration_days),
        predecessor_id = ?,
        predecessor_lag_days = COALESCE(?, predecessor_lag_days),
        is_payment_milestone = COALESCE(?, is_payment_milestone),
        payment_percent = COALESCE(?, payment_percent),
        schedule_of_rates_rate = COALESCE(?, schedule_of_rates_rate),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      code, name, description, level, sort_order, quantity, unit, budgeted_unit_rate,
      start_date, end_date, duration_days, predecessor_id, predecessor_lag_days,
      is_payment_milestone !== undefined ? (is_payment_milestone ? 1 : 0) : undefined,
      payment_percent, schedule_of_rates_rate, req.params.id
    );

    const item = db.prepare('SELECT * FROM wbs_items WHERE id = ?').get(req.params.id);
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update WBS item' });
  }
});

// Delete WBS item
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM wbs_items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete WBS item' });
  }
});

// ============ RESOURCE ASSIGNMENTS ============

// Add plant assignment
router.post('/:id/plant', (req, res) => {
  try {
    const assignmentId = uuidv4();
    const { plant_type_id, budgeted_hours, hourly_rate } = req.body;

    // Get default rate if not provided
    let rate = hourly_rate;
    if (!rate) {
      const plant = db.prepare('SELECT hourly_rate FROM plant_types WHERE id = ?').get(plant_type_id) as any;
      rate = plant?.hourly_rate || 0;
    }

    db.prepare(`
      INSERT INTO wbs_plant_assignments (id, wbs_item_id, plant_type_id, budgeted_hours, hourly_rate)
      VALUES (?, ?, ?, ?, ?)
    `).run(assignmentId, req.params.id, plant_type_id, budgeted_hours || 0, rate);

    const assignment = db.prepare(`
      SELECT wpa.*, pt.code as plant_code, pt.description as plant_description
      FROM wbs_plant_assignments wpa
      JOIN plant_types pt ON wpa.plant_type_id = pt.id
      WHERE wpa.id = ?
    `).get(assignmentId);

    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add plant assignment' });
  }
});

// Update plant assignment
router.put('/plant-assignment/:id', (req, res) => {
  try {
    const { budgeted_hours, hourly_rate } = req.body;

    db.prepare(`
      UPDATE wbs_plant_assignments SET
        budgeted_hours = COALESCE(?, budgeted_hours),
        hourly_rate = COALESCE(?, hourly_rate)
      WHERE id = ?
    `).run(budgeted_hours, hourly_rate, req.params.id);

    const assignment = db.prepare('SELECT * FROM wbs_plant_assignments WHERE id = ?').get(req.params.id);
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update plant assignment' });
  }
});

// Delete plant assignment
router.delete('/plant-assignment/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM wbs_plant_assignments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete plant assignment' });
  }
});

// Add labour assignment
router.post('/:id/labour', (req, res) => {
  try {
    const assignmentId = uuidv4();
    const { labour_type_id, budgeted_hours, hourly_rate, quantity } = req.body;

    let rate = hourly_rate;
    if (!rate) {
      const labour = db.prepare('SELECT hourly_rate FROM labour_types WHERE id = ?').get(labour_type_id) as any;
      rate = labour?.hourly_rate || 0;
    }

    db.prepare(`
      INSERT INTO wbs_labour_assignments (id, wbs_item_id, labour_type_id, budgeted_hours, hourly_rate, quantity)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(assignmentId, req.params.id, labour_type_id, budgeted_hours || 0, rate, quantity || 1);

    const assignment = db.prepare(`
      SELECT wla.*, lt.code as labour_code, lt.role as labour_role
      FROM wbs_labour_assignments wla
      JOIN labour_types lt ON wla.labour_type_id = lt.id
      WHERE wla.id = ?
    `).get(assignmentId);

    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add labour assignment' });
  }
});

// Update labour assignment
router.put('/labour-assignment/:id', (req, res) => {
  try {
    const { budgeted_hours, hourly_rate, quantity } = req.body;

    db.prepare(`
      UPDATE wbs_labour_assignments SET
        budgeted_hours = COALESCE(?, budgeted_hours),
        hourly_rate = COALESCE(?, hourly_rate),
        quantity = COALESCE(?, quantity)
      WHERE id = ?
    `).run(budgeted_hours, hourly_rate, quantity, req.params.id);

    const assignment = db.prepare('SELECT * FROM wbs_labour_assignments WHERE id = ?').get(req.params.id);
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update labour assignment' });
  }
});

// Delete labour assignment
router.delete('/labour-assignment/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM wbs_labour_assignments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete labour assignment' });
  }
});

// Add material assignment
router.post('/:id/material', (req, res) => {
  try {
    const assignmentId = uuidv4();
    const { material_type_id, budgeted_quantity, unit_rate } = req.body;

    let rate = unit_rate;
    if (!rate) {
      const material = db.prepare('SELECT base_rate FROM material_types WHERE id = ?').get(material_type_id) as any;
      rate = material?.base_rate || 0;
    }

    db.prepare(`
      INSERT INTO wbs_material_assignments (id, wbs_item_id, material_type_id, budgeted_quantity, unit_rate)
      VALUES (?, ?, ?, ?, ?)
    `).run(assignmentId, req.params.id, material_type_id, budgeted_quantity || 0, rate);

    const assignment = db.prepare(`
      SELECT wma.*, mt.code as material_code, mt.description as material_description, mt.unit as material_unit
      FROM wbs_material_assignments wma
      JOIN material_types mt ON wma.material_type_id = mt.id
      WHERE wma.id = ?
    `).get(assignmentId);

    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add material assignment' });
  }
});

// Update material assignment
router.put('/material-assignment/:id', (req, res) => {
  try {
    const { budgeted_quantity, unit_rate } = req.body;

    db.prepare(`
      UPDATE wbs_material_assignments SET
        budgeted_quantity = COALESCE(?, budgeted_quantity),
        unit_rate = COALESCE(?, unit_rate)
      WHERE id = ?
    `).run(budgeted_quantity, unit_rate, req.params.id);

    const assignment = db.prepare('SELECT * FROM wbs_material_assignments WHERE id = ?').get(req.params.id);
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update material assignment' });
  }
});

// Delete material assignment
router.delete('/material-assignment/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM wbs_material_assignments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete material assignment' });
  }
});

// Add subcontractor assignment
router.post('/:id/subcontractor', (req, res) => {
  try {
    const assignmentId = uuidv4();
    const { subcontractor_type_id, description, budgeted_value } = req.body;

    db.prepare(`
      INSERT INTO wbs_subcontractor_assignments (id, wbs_item_id, subcontractor_type_id, description, budgeted_value)
      VALUES (?, ?, ?, ?, ?)
    `).run(assignmentId, req.params.id, subcontractor_type_id, description, budgeted_value || 0);

    const assignment = db.prepare(`
      SELECT wsa.*, st.code as subcontractor_code, st.trade as subcontractor_trade
      FROM wbs_subcontractor_assignments wsa
      JOIN subcontractor_types st ON wsa.subcontractor_type_id = st.id
      WHERE wsa.id = ?
    `).get(assignmentId);

    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add subcontractor assignment' });
  }
});

// Update subcontractor assignment
router.put('/subcontractor-assignment/:id', (req, res) => {
  try {
    const { description, budgeted_value } = req.body;

    db.prepare(`
      UPDATE wbs_subcontractor_assignments SET
        description = COALESCE(?, description),
        budgeted_value = COALESCE(?, budgeted_value)
      WHERE id = ?
    `).run(description, budgeted_value, req.params.id);

    const assignment = db.prepare('SELECT * FROM wbs_subcontractor_assignments WHERE id = ?').get(req.params.id);
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update subcontractor assignment' });
  }
});

// Delete subcontractor assignment
router.delete('/subcontractor-assignment/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM wbs_subcontractor_assignments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete subcontractor assignment' });
  }
});

// ============ PROGRAMME CALCULATION ============

// Recalculate programme dates based on dependencies
router.post('/project/:projectId/recalculate-programme', (req, res) => {
  try {
    const projectId = req.params.projectId;
    const { start_date } = req.body;

    // Get all WBS items ordered by dependencies
    const items = db.prepare(`
      SELECT * FROM wbs_items
      WHERE project_id = ?
      ORDER BY sort_order, code
    `).all(projectId) as any[];

    // Build dependency map
    const itemMap = new Map(items.map(i => [i.id, i]));

    // Calculate dates
    for (const item of items) {
      let itemStart = start_date;

      if (item.predecessor_id) {
        const predecessor = itemMap.get(item.predecessor_id);
        if (predecessor && predecessor.end_date) {
          // Add lag days
          const predEnd = new Date(predecessor.end_date);
          predEnd.setDate(predEnd.getDate() + (item.predecessor_lag_days || 0));
          itemStart = predEnd.toISOString().split('T')[0];
        }
      }

      // Calculate end date
      const startDt = new Date(itemStart);
      startDt.setDate(startDt.getDate() + (item.duration_days || 0));
      const endDate = startDt.toISOString().split('T')[0];

      // Update item
      db.prepare(`
        UPDATE wbs_items SET start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(itemStart, endDate, item.id);

      // Update in map for next iterations
      item.start_date = itemStart;
      item.end_date = endDate;
    }

    // Return updated items
    const updatedItems = db.prepare('SELECT * FROM wbs_items WHERE project_id = ? ORDER BY sort_order, code').all(projectId);
    res.json(updatedItems);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to recalculate programme' });
  }
});

export default router;
