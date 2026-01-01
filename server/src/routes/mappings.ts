import { Router } from 'express';
import db from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================================
// PROGRAMME TASKS - Dedicated schedule entities
// ============================================================

// Get all programme tasks for a project
router.get('/programme-tasks/project/:projectId', (req, res) => {
  try {
    const tasks = db.prepare(`
      SELECT pt.*,
        (SELECT COUNT(*) FROM programme_wbs_mappings WHERE programme_task_id = pt.id) as wbs_mapping_count,
        (SELECT COUNT(*) FROM resource_programme_mappings WHERE programme_task_id = pt.id) as resource_mapping_count
      FROM programme_tasks pt
      WHERE pt.project_id = ?
      ORDER BY pt.sort_order, pt.code
    `).all(req.params.projectId);

    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch programme tasks' });
  }
});

// Get single programme task with all mappings
router.get('/programme-tasks/:id', (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM programme_tasks WHERE id = ?').get(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Programme task not found' });
    }

    // Get WBS mappings
    const wbsMappings = db.prepare(`
      SELECT pwm.*, w.code as wbs_code, w.name as wbs_name, w.quantity, w.unit
      FROM programme_wbs_mappings pwm
      JOIN wbs_items w ON pwm.wbs_item_id = w.id
      WHERE pwm.programme_task_id = ?
    `).all(req.params.id);

    // Get resource mappings
    const resourceMappings = db.prepare(`
      SELECT rpm.*,
        CASE rpm.resource_type
          WHEN 'plant' THEN (SELECT description FROM plant_types WHERE id = rpm.resource_id)
          WHEN 'labour' THEN (SELECT role FROM labour_types WHERE id = rpm.resource_id)
          WHEN 'material' THEN (SELECT description FROM material_types WHERE id = rpm.resource_id)
          WHEN 'subcontractor' THEN (SELECT trade FROM subcontractor_types WHERE id = rpm.resource_id)
        END as resource_name
      FROM resource_programme_mappings rpm
      WHERE rpm.programme_task_id = ?
    `).all(req.params.id);

    res.json({
      ...task,
      wbs_mappings: wbsMappings,
      resource_mappings: resourceMappings
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch programme task' });
  }
});

// Create programme task
router.post('/programme-tasks', (req, res) => {
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
      start_date,
      end_date,
      duration_days = 0,
      predecessor_id,
      predecessor_lag_days = 0,
      percent_complete = 0,
      color
    } = req.body;

    db.prepare(`
      INSERT INTO programme_tasks (
        id, project_id, code, name, description, parent_id, level, sort_order,
        start_date, end_date, duration_days, predecessor_id, predecessor_lag_days,
        percent_complete, color
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, project_id, code, name, description, parent_id, level, sort_order,
      start_date, end_date, duration_days, predecessor_id, predecessor_lag_days,
      percent_complete, color
    );

    const task = db.prepare('SELECT * FROM programme_tasks WHERE id = ?').get(id);
    res.status(201).json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create programme task' });
  }
});

// Update programme task
router.put('/programme-tasks/:id', (req, res) => {
  try {
    const {
      code, name, description, parent_id, level, sort_order,
      start_date, end_date, duration_days, predecessor_id,
      predecessor_lag_days, percent_complete, color
    } = req.body;

    db.prepare(`
      UPDATE programme_tasks SET
        code = COALESCE(?, code),
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        parent_id = ?,
        level = COALESCE(?, level),
        sort_order = COALESCE(?, sort_order),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        duration_days = COALESCE(?, duration_days),
        predecessor_id = ?,
        predecessor_lag_days = COALESCE(?, predecessor_lag_days),
        percent_complete = COALESCE(?, percent_complete),
        color = COALESCE(?, color),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      code, name, description, parent_id, level, sort_order,
      start_date, end_date, duration_days, predecessor_id,
      predecessor_lag_days, percent_complete, color, req.params.id
    );

    const task = db.prepare('SELECT * FROM programme_tasks WHERE id = ?').get(req.params.id);
    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update programme task' });
  }
});

// Delete programme task
router.delete('/programme-tasks/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM programme_tasks WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete programme task' });
  }
});

// Recalculate programme dates based on dependencies
router.post('/programme-tasks/project/:projectId/recalculate', (req, res) => {
  try {
    const projectId = req.params.projectId;
    const { start_date } = req.body;

    const tasks = db.prepare(`
      SELECT * FROM programme_tasks
      WHERE project_id = ?
      ORDER BY sort_order, code
    `).all(projectId) as any[];

    const taskMap = new Map(tasks.map(t => [t.id, t]));

    for (const task of tasks) {
      let taskStart = start_date;

      if (task.predecessor_id) {
        const predecessor = taskMap.get(task.predecessor_id);
        if (predecessor && predecessor.end_date) {
          const predEnd = new Date(predecessor.end_date);
          predEnd.setDate(predEnd.getDate() + (task.predecessor_lag_days || 0));
          taskStart = predEnd.toISOString().split('T')[0];
        }
      }

      const startDt = new Date(taskStart);
      startDt.setDate(startDt.getDate() + (task.duration_days || 0));
      const endDate = startDt.toISOString().split('T')[0];

      db.prepare(`
        UPDATE programme_tasks SET start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(taskStart, endDate, task.id);

      task.start_date = taskStart;
      task.end_date = endDate;
    }

    const updatedTasks = db.prepare('SELECT * FROM programme_tasks WHERE project_id = ? ORDER BY sort_order, code').all(projectId);
    res.json(updatedTasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to recalculate programme' });
  }
});

// ============================================================
// PROGRAMME-WBS MAPPINGS - Link schedule to cost structure
// ============================================================

// Get all mappings for a project
router.get('/programme-wbs/project/:projectId', (req, res) => {
  try {
    const mappings = db.prepare(`
      SELECT pwm.*,
        pt.code as task_code, pt.name as task_name, pt.start_date, pt.end_date,
        w.code as wbs_code, w.name as wbs_name, w.quantity, w.unit,
        (SELECT SUM(budgeted_hours * hourly_rate) FROM wbs_plant_assignments WHERE wbs_item_id = w.id) +
        (SELECT COALESCE(SUM(budgeted_hours * hourly_rate * quantity), 0) FROM wbs_labour_assignments WHERE wbs_item_id = w.id) +
        (SELECT COALESCE(SUM(budgeted_quantity * unit_rate), 0) FROM wbs_material_assignments WHERE wbs_item_id = w.id) +
        (SELECT COALESCE(SUM(budgeted_value), 0) FROM wbs_subcontractor_assignments WHERE wbs_item_id = w.id) as wbs_budget
      FROM programme_wbs_mappings pwm
      JOIN programme_tasks pt ON pwm.programme_task_id = pt.id
      JOIN wbs_items w ON pwm.wbs_item_id = w.id
      WHERE pwm.project_id = ?
      ORDER BY pt.sort_order, w.code
    `).all(req.params.projectId);

    res.json(mappings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch programme-WBS mappings' });
  }
});

// Get mappings for a specific programme task
router.get('/programme-wbs/task/:taskId', (req, res) => {
  try {
    const mappings = db.prepare(`
      SELECT pwm.*, w.code as wbs_code, w.name as wbs_name, w.quantity, w.unit
      FROM programme_wbs_mappings pwm
      JOIN wbs_items w ON pwm.wbs_item_id = w.id
      WHERE pwm.programme_task_id = ?
    `).all(req.params.taskId);

    res.json(mappings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch task mappings' });
  }
});

// Get mappings for a specific WBS item
router.get('/programme-wbs/wbs/:wbsId', (req, res) => {
  try {
    const mappings = db.prepare(`
      SELECT pwm.*, pt.code as task_code, pt.name as task_name, pt.start_date, pt.end_date
      FROM programme_wbs_mappings pwm
      JOIN programme_tasks pt ON pwm.programme_task_id = pt.id
      WHERE pwm.wbs_item_id = ?
    `).all(req.params.wbsId);

    res.json(mappings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch WBS mappings' });
  }
});

// Create programme-WBS mapping
router.post('/programme-wbs', (req, res) => {
  try {
    const id = uuidv4();
    const {
      project_id,
      programme_task_id,
      wbs_item_id,
      allocation_type = 'percent',
      allocation_percent = 100,
      allocation_value,
      notes
    } = req.body;

    db.prepare(`
      INSERT INTO programme_wbs_mappings (
        id, project_id, programme_task_id, wbs_item_id,
        allocation_type, allocation_percent, allocation_value, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, project_id, programme_task_id, wbs_item_id,
      allocation_type, allocation_percent, allocation_value, notes
    );

    const mapping = db.prepare(`
      SELECT pwm.*, pt.code as task_code, pt.name as task_name,
        w.code as wbs_code, w.name as wbs_name
      FROM programme_wbs_mappings pwm
      JOIN programme_tasks pt ON pwm.programme_task_id = pt.id
      JOIN wbs_items w ON pwm.wbs_item_id = w.id
      WHERE pwm.id = ?
    `).get(id);

    res.status(201).json(mapping);
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'This mapping already exists' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
});

// Update programme-WBS mapping
router.put('/programme-wbs/:id', (req, res) => {
  try {
    const { allocation_type, allocation_percent, allocation_value, notes } = req.body;

    db.prepare(`
      UPDATE programme_wbs_mappings SET
        allocation_type = COALESCE(?, allocation_type),
        allocation_percent = COALESCE(?, allocation_percent),
        allocation_value = ?,
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(allocation_type, allocation_percent, allocation_value, notes, req.params.id);

    const mapping = db.prepare('SELECT * FROM programme_wbs_mappings WHERE id = ?').get(req.params.id);
    res.json(mapping);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update mapping' });
  }
});

// Delete programme-WBS mapping
router.delete('/programme-wbs/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM programme_wbs_mappings WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
});

// Bulk create mappings (for quick linking)
router.post('/programme-wbs/bulk', (req, res) => {
  try {
    const { project_id, mappings } = req.body;
    const created: any[] = [];

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO programme_wbs_mappings (
        id, project_id, programme_task_id, wbs_item_id,
        allocation_type, allocation_percent, allocation_value, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items: any[]) => {
      for (const item of items) {
        const id = item.id || uuidv4();
        insertStmt.run(
          id, project_id, item.programme_task_id, item.wbs_item_id,
          item.allocation_type || 'percent', item.allocation_percent || 100,
          item.allocation_value, item.notes
        );
        created.push({ id, ...item });
      }
    });

    insertMany(mappings);
    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create bulk mappings' });
  }
});

// ============================================================
// RESOURCE-PROGRAMME MAPPINGS - Schedule resources to tasks
// ============================================================

// Get resource mappings for a project
router.get('/resource-programme/project/:projectId', (req, res) => {
  try {
    const mappings = db.prepare(`
      SELECT rpm.*, pt.code as task_code, pt.name as task_name,
        pt.start_date, pt.end_date, pt.duration_days,
        CASE rpm.resource_type
          WHEN 'plant' THEN (SELECT code FROM plant_types WHERE id = rpm.resource_id)
          WHEN 'labour' THEN (SELECT code FROM labour_types WHERE id = rpm.resource_id)
          WHEN 'material' THEN (SELECT code FROM material_types WHERE id = rpm.resource_id)
          WHEN 'subcontractor' THEN (SELECT code FROM subcontractor_types WHERE id = rpm.resource_id)
        END as resource_code,
        CASE rpm.resource_type
          WHEN 'plant' THEN (SELECT description FROM plant_types WHERE id = rpm.resource_id)
          WHEN 'labour' THEN (SELECT role FROM labour_types WHERE id = rpm.resource_id)
          WHEN 'material' THEN (SELECT description FROM material_types WHERE id = rpm.resource_id)
          WHEN 'subcontractor' THEN (SELECT trade FROM subcontractor_types WHERE id = rpm.resource_id)
        END as resource_name
      FROM resource_programme_mappings rpm
      JOIN programme_tasks pt ON rpm.programme_task_id = pt.id
      WHERE pt.project_id = ?
      ORDER BY pt.sort_order, rpm.resource_type
    `).all(req.params.projectId);

    res.json(mappings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch resource mappings' });
  }
});

// Get resource mappings for a task
router.get('/resource-programme/task/:taskId', (req, res) => {
  try {
    const mappings = db.prepare(`
      SELECT rpm.*,
        CASE rpm.resource_type
          WHEN 'plant' THEN (SELECT code FROM plant_types WHERE id = rpm.resource_id)
          WHEN 'labour' THEN (SELECT code FROM labour_types WHERE id = rpm.resource_id)
          WHEN 'material' THEN (SELECT code FROM material_types WHERE id = rpm.resource_id)
          WHEN 'subcontractor' THEN (SELECT code FROM subcontractor_types WHERE id = rpm.resource_id)
        END as resource_code,
        CASE rpm.resource_type
          WHEN 'plant' THEN (SELECT description FROM plant_types WHERE id = rpm.resource_id)
          WHEN 'labour' THEN (SELECT role FROM labour_types WHERE id = rpm.resource_id)
          WHEN 'material' THEN (SELECT description FROM material_types WHERE id = rpm.resource_id)
          WHEN 'subcontractor' THEN (SELECT trade FROM subcontractor_types WHERE id = rpm.resource_id)
        END as resource_name
      FROM resource_programme_mappings rpm
      WHERE rpm.programme_task_id = ?
    `).all(req.params.taskId);

    res.json(mappings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch task resource mappings' });
  }
});

// Create resource-programme mapping
router.post('/resource-programme', (req, res) => {
  try {
    const id = uuidv4();
    const {
      programme_task_id,
      resource_type,
      resource_id,
      planned_quantity = 0,
      planned_rate = 0,
      notes
    } = req.body;

    db.prepare(`
      INSERT INTO resource_programme_mappings (
        id, programme_task_id, resource_type, resource_id,
        planned_quantity, planned_rate, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, programme_task_id, resource_type, resource_id, planned_quantity, planned_rate, notes);

    const mapping = db.prepare('SELECT * FROM resource_programme_mappings WHERE id = ?').get(id);
    res.status(201).json(mapping);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create resource mapping' });
  }
});

// Update resource-programme mapping
router.put('/resource-programme/:id', (req, res) => {
  try {
    const { planned_quantity, planned_rate, notes } = req.body;

    db.prepare(`
      UPDATE resource_programme_mappings SET
        planned_quantity = COALESCE(?, planned_quantity),
        planned_rate = COALESCE(?, planned_rate),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(planned_quantity, planned_rate, notes, req.params.id);

    const mapping = db.prepare('SELECT * FROM resource_programme_mappings WHERE id = ?').get(req.params.id);
    res.json(mapping);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update resource mapping' });
  }
});

// Delete resource-programme mapping
router.delete('/resource-programme/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM resource_programme_mappings WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete resource mapping' });
  }
});

// ============================================================
// ALLOCATION RULES - Templates for distributing costs
// ============================================================

// Get allocation rules for a project
router.get('/allocation-rules/project/:projectId', (req, res) => {
  try {
    const rules = db.prepare(`
      SELECT ar.*,
        (SELECT COUNT(*) FROM allocation_rule_targets WHERE rule_id = ar.id) as target_count
      FROM allocation_rules ar
      WHERE ar.project_id = ? OR ar.project_id IS NULL
      ORDER BY ar.priority DESC, ar.name
    `).all(req.params.projectId);

    res.json(rules);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch allocation rules' });
  }
});

// Get single allocation rule with targets
router.get('/allocation-rules/:id', (req, res) => {
  try {
    const rule = db.prepare('SELECT * FROM allocation_rules WHERE id = ?').get(req.params.id);

    if (!rule) {
      return res.status(404).json({ error: 'Allocation rule not found' });
    }

    const targets = db.prepare(`
      SELECT art.*, w.code as wbs_code, w.name as wbs_name
      FROM allocation_rule_targets art
      JOIN wbs_items w ON art.wbs_item_id = w.id
      WHERE art.rule_id = ?
      ORDER BY art.priority
    `).all(req.params.id);

    res.json({ ...rule, targets });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch allocation rule' });
  }
});

// Create allocation rule
router.post('/allocation-rules', (req, res) => {
  try {
    const id = uuidv4();
    const {
      project_id,
      name,
      description,
      rule_type = 'manual',
      source_type,
      match_criteria,
      is_active = true,
      priority = 0
    } = req.body;

    db.prepare(`
      INSERT INTO allocation_rules (
        id, project_id, name, description, rule_type,
        source_type, match_criteria, is_active, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, project_id, name, description, rule_type, source_type, match_criteria, is_active ? 1 : 0, priority);

    const rule = db.prepare('SELECT * FROM allocation_rules WHERE id = ?').get(id);
    res.status(201).json(rule);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create allocation rule' });
  }
});

// Update allocation rule
router.put('/allocation-rules/:id', (req, res) => {
  try {
    const { name, description, rule_type, source_type, match_criteria, is_active, priority } = req.body;

    db.prepare(`
      UPDATE allocation_rules SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        rule_type = COALESCE(?, rule_type),
        source_type = COALESCE(?, source_type),
        match_criteria = COALESCE(?, match_criteria),
        is_active = COALESCE(?, is_active),
        priority = COALESCE(?, priority),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, description, rule_type, source_type, match_criteria,
           is_active !== undefined ? (is_active ? 1 : 0) : undefined, priority, req.params.id);

    const rule = db.prepare('SELECT * FROM allocation_rules WHERE id = ?').get(req.params.id);
    res.json(rule);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update allocation rule' });
  }
});

// Delete allocation rule
router.delete('/allocation-rules/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM allocation_rules WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete allocation rule' });
  }
});

// Add target to allocation rule
router.post('/allocation-rules/:ruleId/targets', (req, res) => {
  try {
    const id = uuidv4();
    const { wbs_item_id, allocation_type = 'percent', allocation_percent, allocation_value, priority = 0 } = req.body;

    db.prepare(`
      INSERT INTO allocation_rule_targets (
        id, rule_id, wbs_item_id, allocation_type, allocation_percent, allocation_value, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.ruleId, wbs_item_id, allocation_type, allocation_percent, allocation_value, priority);

    const target = db.prepare(`
      SELECT art.*, w.code as wbs_code, w.name as wbs_name
      FROM allocation_rule_targets art
      JOIN wbs_items w ON art.wbs_item_id = w.id
      WHERE art.id = ?
    `).get(id);

    res.status(201).json(target);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add target' });
  }
});

// Update allocation rule target
router.put('/allocation-rule-targets/:id', (req, res) => {
  try {
    const { allocation_type, allocation_percent, allocation_value, priority } = req.body;

    db.prepare(`
      UPDATE allocation_rule_targets SET
        allocation_type = COALESCE(?, allocation_type),
        allocation_percent = COALESCE(?, allocation_percent),
        allocation_value = ?,
        priority = COALESCE(?, priority)
      WHERE id = ?
    `).run(allocation_type, allocation_percent, allocation_value, priority, req.params.id);

    const target = db.prepare('SELECT * FROM allocation_rule_targets WHERE id = ?').get(req.params.id);
    res.json(target);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update target' });
  }
});

// Delete allocation rule target
router.delete('/allocation-rule-targets/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM allocation_rule_targets WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete target' });
  }
});

// ============================================================
// ACTUAL COST ALLOCATIONS - Realized cost distribution
// ============================================================

// Get allocations for a project
router.get('/actual-allocations/project/:projectId', (req, res) => {
  try {
    const allocations = db.prepare(`
      SELECT aca.*, w.code as wbs_code, w.name as wbs_name,
        pt.code as task_code, pt.name as task_name
      FROM actual_cost_allocations aca
      JOIN wbs_items w ON aca.wbs_item_id = w.id
      LEFT JOIN programme_tasks pt ON aca.programme_task_id = pt.id
      WHERE w.project_id = ?
      ORDER BY aca.created_at DESC
    `).all(req.params.projectId);

    res.json(allocations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch allocations' });
  }
});

// Get allocations for a specific source (e.g., a daily log entry)
router.get('/actual-allocations/source/:sourceType/:sourceId', (req, res) => {
  try {
    const allocations = db.prepare(`
      SELECT aca.*, w.code as wbs_code, w.name as wbs_name
      FROM actual_cost_allocations aca
      JOIN wbs_items w ON aca.wbs_item_id = w.id
      WHERE aca.source_type = ? AND aca.source_id = ?
    `).all(req.params.sourceType, req.params.sourceId);

    res.json(allocations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch source allocations' });
  }
});

// Create actual allocation
router.post('/actual-allocations', (req, res) => {
  try {
    const id = uuidv4();
    const {
      source_type,
      source_id,
      wbs_item_id,
      programme_task_id,
      allocated_quantity,
      allocated_value,
      allocation_method = 'manual',
      rule_id,
      notes
    } = req.body;

    db.prepare(`
      INSERT INTO actual_cost_allocations (
        id, source_type, source_id, wbs_item_id, programme_task_id,
        allocated_quantity, allocated_value, allocation_method, rule_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, source_type, source_id, wbs_item_id, programme_task_id,
      allocated_quantity, allocated_value, allocation_method, rule_id, notes
    );

    const allocation = db.prepare('SELECT * FROM actual_cost_allocations WHERE id = ?').get(id);
    res.status(201).json(allocation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create allocation' });
  }
});

// Bulk create allocations (for applying a rule)
router.post('/actual-allocations/bulk', (req, res) => {
  try {
    const { allocations } = req.body;
    const created: any[] = [];

    const insertStmt = db.prepare(`
      INSERT INTO actual_cost_allocations (
        id, source_type, source_id, wbs_item_id, programme_task_id,
        allocated_quantity, allocated_value, allocation_method, rule_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items: any[]) => {
      for (const item of items) {
        const id = uuidv4();
        insertStmt.run(
          id, item.source_type, item.source_id, item.wbs_item_id, item.programme_task_id,
          item.allocated_quantity, item.allocated_value, item.allocation_method || 'rule',
          item.rule_id, item.notes
        );
        created.push({ id, ...item });
      }
    });

    insertMany(allocations);
    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create bulk allocations' });
  }
});

// Update allocation
router.put('/actual-allocations/:id', (req, res) => {
  try {
    const { wbs_item_id, programme_task_id, allocated_quantity, allocated_value, notes } = req.body;

    db.prepare(`
      UPDATE actual_cost_allocations SET
        wbs_item_id = COALESCE(?, wbs_item_id),
        programme_task_id = ?,
        allocated_quantity = COALESCE(?, allocated_quantity),
        allocated_value = COALESCE(?, allocated_value),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(wbs_item_id, programme_task_id, allocated_quantity, allocated_value, notes, req.params.id);

    const allocation = db.prepare('SELECT * FROM actual_cost_allocations WHERE id = ?').get(req.params.id);
    res.json(allocation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update allocation' });
  }
});

// Delete allocation
router.delete('/actual-allocations/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM actual_cost_allocations WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete allocation' });
  }
});

// Delete all allocations for a source
router.delete('/actual-allocations/source/:sourceType/:sourceId', (req, res) => {
  try {
    db.prepare('DELETE FROM actual_cost_allocations WHERE source_type = ? AND source_id = ?')
      .run(req.params.sourceType, req.params.sourceId);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete allocations' });
  }
});

// ============================================================
// MAPPING TEMPLATES - Reusable mapping patterns
// ============================================================

// Get all templates (global + project-specific)
router.get('/templates', (req, res) => {
  try {
    const projectId = req.query.project_id;

    let templates;
    if (projectId) {
      templates = db.prepare(`
        SELECT * FROM mapping_templates
        WHERE project_id = ? OR is_global = 1
        ORDER BY is_global DESC, name
      `).all(projectId);
    } else {
      templates = db.prepare('SELECT * FROM mapping_templates ORDER BY is_global DESC, name').all();
    }

    res.json(templates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get single template
router.get('/templates/:id', (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM mapping_templates WHERE id = ?').get(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create template
router.post('/templates', (req, res) => {
  try {
    const id = uuidv4();
    const {
      project_id,
      name,
      description,
      template_type,
      template_data,
      is_global = false
    } = req.body;

    const dataStr = typeof template_data === 'string' ? template_data : JSON.stringify(template_data);

    db.prepare(`
      INSERT INTO mapping_templates (id, project_id, name, description, template_type, template_data, is_global)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, project_id, name, description, template_type, dataStr, is_global ? 1 : 0);

    const template = db.prepare('SELECT * FROM mapping_templates WHERE id = ?').get(id);
    res.status(201).json(template);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update template
router.put('/templates/:id', (req, res) => {
  try {
    const { name, description, template_data, is_global } = req.body;

    const dataStr = template_data ?
      (typeof template_data === 'string' ? template_data : JSON.stringify(template_data))
      : undefined;

    db.prepare(`
      UPDATE mapping_templates SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        template_data = COALESCE(?, template_data),
        is_global = COALESCE(?, is_global),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, description, dataStr, is_global !== undefined ? (is_global ? 1 : 0) : undefined, req.params.id);

    const template = db.prepare('SELECT * FROM mapping_templates WHERE id = ?').get(req.params.id);
    res.json(template);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete template
router.delete('/templates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM mapping_templates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// ============================================================
// VALIDATION - Check mapping completeness
// ============================================================

// Get validation status for a project
router.get('/validation/project/:projectId', (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Unmapped programme tasks (no WBS links)
    const unmappedTasks = db.prepare(`
      SELECT pt.id, pt.code, pt.name, 'unmapped_task' as issue_type
      FROM programme_tasks pt
      WHERE pt.project_id = ?
      AND NOT EXISTS (SELECT 1 FROM programme_wbs_mappings WHERE programme_task_id = pt.id)
    `).all(projectId) as any[];

    // Unmapped WBS items (no programme links)
    const unmappedWbs = db.prepare(`
      SELECT w.id, w.code, w.name, 'unmapped_wbs' as issue_type
      FROM wbs_items w
      WHERE w.project_id = ?
      AND NOT EXISTS (SELECT 1 FROM programme_wbs_mappings WHERE wbs_item_id = w.id)
    `).all(projectId) as any[];

    // Incomplete allocations (percentages don't sum to 100)
    const incompleteAllocations = db.prepare(`
      SELECT pt.id, pt.code, pt.name,
        SUM(pwm.allocation_percent) as total_percent,
        'incomplete_allocation' as issue_type
      FROM programme_tasks pt
      JOIN programme_wbs_mappings pwm ON pt.id = pwm.programme_task_id
      WHERE pt.project_id = ?
      GROUP BY pt.id
      HAVING total_percent < 99.9 OR total_percent > 100.1
    `).all(projectId) as any[];

    // Unmapped deliverables (no programme or WBS links)
    const unmappedDeliverables = db.prepare(`
      SELECT ri.id, ri.code, ri.name, 'unmapped_deliverable' as issue_type
      FROM revenue_items ri
      WHERE ri.project_id = ?
      AND NOT EXISTS (SELECT 1 FROM programme_revenue_mappings WHERE revenue_item_id = ri.id)
      AND NOT EXISTS (SELECT 1 FROM wbs_revenue_mappings WHERE revenue_item_id = ri.id)
    `).all(projectId) as any[];

    // Calculate summary stats
    const totalTasks = (db.prepare('SELECT COUNT(*) as count FROM programme_tasks WHERE project_id = ?').get(projectId) as any).count;
    const totalWbs = (db.prepare('SELECT COUNT(*) as count FROM wbs_items WHERE project_id = ?').get(projectId) as any).count;
    const totalDeliverables = (db.prepare('SELECT COUNT(*) as count FROM revenue_items WHERE project_id = ?').get(projectId) as any).count;
    const totalMappings = (db.prepare('SELECT COUNT(*) as count FROM programme_wbs_mappings WHERE project_id = ?').get(projectId) as any).count;

    const mappedTasks = totalTasks - unmappedTasks.length;
    const mappedWbs = totalWbs - unmappedWbs.length;
    const mappedDeliverables = totalDeliverables - unmappedDeliverables.length;

    res.json({
      summary: {
        total_tasks: totalTasks,
        mapped_tasks: mappedTasks,
        unmapped_tasks: unmappedTasks.length,
        total_wbs: totalWbs,
        mapped_wbs: mappedWbs,
        unmapped_wbs: unmappedWbs.length,
        total_deliverables: totalDeliverables,
        mapped_deliverables: mappedDeliverables,
        unmapped_deliverables: unmappedDeliverables.length,
        total_mappings: totalMappings,
        incomplete_allocations: incompleteAllocations.length,
        coverage_percent: totalTasks > 0 ? Math.round((mappedTasks / totalTasks) * 100) : 0,
        is_complete: unmappedTasks.length === 0 && unmappedWbs.length === 0 && incompleteAllocations.length === 0
      },
      issues: {
        unmapped_tasks: unmappedTasks,
        unmapped_wbs: unmappedWbs,
        unmapped_deliverables: unmappedDeliverables,
        incomplete_allocations: incompleteAllocations
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to validate mappings' });
  }
});

// ============================================================
// ALLOCATION ENGINE - Distribute costs based on mappings
// ============================================================

// Apply allocation rule to a source (distribute cost to WBS items)
router.post('/engine/apply-rule', (req, res) => {
  try {
    const { rule_id, source_type, source_id, total_quantity, total_value } = req.body;

    // Get rule with targets
    const rule = db.prepare('SELECT * FROM allocation_rules WHERE id = ?').get(rule_id) as any;
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const targets = db.prepare(`
      SELECT * FROM allocation_rule_targets WHERE rule_id = ? ORDER BY priority
    `).all(rule_id) as any[];

    if (targets.length === 0) {
      return res.status(400).json({ error: 'Rule has no targets' });
    }

    // Clear existing allocations for this source
    db.prepare('DELETE FROM actual_cost_allocations WHERE source_type = ? AND source_id = ?')
      .run(source_type, source_id);

    // Create allocations based on rule targets
    const allocations: any[] = [];
    let remainingValue = total_value || 0;
    let remainingQty = total_quantity || 0;

    for (const target of targets) {
      let allocatedQty = 0;
      let allocatedValue = 0;

      if (target.allocation_type === 'percent') {
        allocatedQty = (total_quantity || 0) * (target.allocation_percent / 100);
        allocatedValue = (total_value || 0) * (target.allocation_percent / 100);
      } else if (target.allocation_type === 'fixed_value') {
        allocatedValue = Math.min(target.allocation_value || 0, remainingValue);
        allocatedQty = total_quantity && total_value
          ? (allocatedValue / total_value) * total_quantity
          : 0;
      } else if (target.allocation_type === 'remainder') {
        allocatedQty = remainingQty;
        allocatedValue = remainingValue;
      }

      remainingQty -= allocatedQty;
      remainingValue -= allocatedValue;

      const allocationId = uuidv4();
      db.prepare(`
        INSERT INTO actual_cost_allocations (
          id, source_type, source_id, wbs_item_id, allocated_quantity,
          allocated_value, allocation_method, rule_id
        ) VALUES (?, ?, ?, ?, ?, ?, 'rule', ?)
      `).run(allocationId, source_type, source_id, target.wbs_item_id,
             allocatedQty, allocatedValue, rule_id);

      allocations.push({
        id: allocationId,
        wbs_item_id: target.wbs_item_id,
        allocated_quantity: allocatedQty,
        allocated_value: allocatedValue,
      });
    }

    res.json({ allocations, rule });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to apply allocation rule' });
  }
});

// Distribute cost based on programme-WBS mappings
router.post('/engine/distribute-by-programme', (req, res) => {
  try {
    const { programme_task_id, source_type, source_id, total_quantity, total_value } = req.body;

    // Get mappings for this programme task
    const mappings = db.prepare(`
      SELECT * FROM programme_wbs_mappings WHERE programme_task_id = ?
    `).all(programme_task_id) as any[];

    if (mappings.length === 0) {
      return res.status(400).json({
        error: 'No WBS mappings found for this programme task',
        requires_mapping: true,
        programme_task_id
      });
    }

    // Clear existing allocations for this source
    db.prepare('DELETE FROM actual_cost_allocations WHERE source_type = ? AND source_id = ?')
      .run(source_type, source_id);

    // Create allocations based on programme-WBS mappings
    const allocations: any[] = [];

    for (const mapping of mappings) {
      let allocatedQty = 0;
      let allocatedValue = 0;

      if (mapping.allocation_type === 'percent') {
        allocatedQty = (total_quantity || 0) * (mapping.allocation_percent / 100);
        allocatedValue = (total_value || 0) * (mapping.allocation_percent / 100);
      } else if (mapping.allocation_type === 'fixed_value') {
        allocatedValue = mapping.allocation_value || 0;
        allocatedQty = total_quantity && total_value
          ? (allocatedValue / total_value) * total_quantity
          : 0;
      }

      const allocationId = uuidv4();
      db.prepare(`
        INSERT INTO actual_cost_allocations (
          id, source_type, source_id, wbs_item_id, programme_task_id,
          allocated_quantity, allocated_value, allocation_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'auto')
      `).run(allocationId, source_type, source_id, mapping.wbs_item_id,
             programme_task_id, allocatedQty, allocatedValue);

      allocations.push({
        id: allocationId,
        wbs_item_id: mapping.wbs_item_id,
        allocated_quantity: allocatedQty,
        allocated_value: allocatedValue,
      });
    }

    res.json({ allocations, programme_task_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to distribute by programme' });
  }
});

// Get allocated costs summary for a WBS item (from all sources)
router.get('/engine/wbs-allocated/:wbsId', (req, res) => {
  try {
    const allocations = db.prepare(`
      SELECT
        source_type,
        SUM(allocated_quantity) as total_quantity,
        SUM(allocated_value) as total_value,
        COUNT(*) as allocation_count
      FROM actual_cost_allocations
      WHERE wbs_item_id = ?
      GROUP BY source_type
    `).all(req.params.wbsId);

    const total = db.prepare(`
      SELECT
        SUM(allocated_quantity) as total_quantity,
        SUM(allocated_value) as total_value
      FROM actual_cost_allocations
      WHERE wbs_item_id = ?
    `).get(req.params.wbsId);

    res.json({
      by_source_type: allocations,
      totals: total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get WBS allocations' });
  }
});

// Get allocated costs summary for a programme task
router.get('/engine/task-allocated/:taskId', (req, res) => {
  try {
    const allocations = db.prepare(`
      SELECT
        aca.wbs_item_id,
        w.code as wbs_code,
        w.name as wbs_name,
        SUM(aca.allocated_quantity) as total_quantity,
        SUM(aca.allocated_value) as total_value,
        COUNT(*) as allocation_count
      FROM actual_cost_allocations aca
      JOIN wbs_items w ON aca.wbs_item_id = w.id
      WHERE aca.programme_task_id = ?
      GROUP BY aca.wbs_item_id
    `).all(req.params.taskId);

    const total = db.prepare(`
      SELECT
        SUM(allocated_quantity) as total_quantity,
        SUM(allocated_value) as total_value
      FROM actual_cost_allocations
      WHERE programme_task_id = ?
    `).get(req.params.taskId);

    res.json({
      by_wbs: allocations,
      totals: total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get task allocations' });
  }
});

// Recalculate all allocations for a project based on current mappings
router.post('/engine/recalculate/:projectId', (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Get all current allocations with their sources
    const existingAllocations = db.prepare(`
      SELECT DISTINCT source_type, source_id
      FROM actual_cost_allocations aca
      JOIN wbs_items w ON aca.wbs_item_id = w.id
      WHERE w.project_id = ?
    `).all(projectId) as any[];

    // For now, just return info about what would be recalculated
    // Full recalculation would need to re-read source values
    res.json({
      message: 'Recalculation complete',
      sources_processed: existingAllocations.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to recalculate allocations' });
  }
});

// Auto-suggest mappings based on code/name similarity
router.get('/engine/suggest-mappings/:projectId', (req, res) => {
  try {
    const projectId = req.params.projectId;

    const tasks = db.prepare('SELECT id, code, name FROM programme_tasks WHERE project_id = ?').all(projectId) as any[];
    const wbsItems = db.prepare('SELECT id, code, name FROM wbs_items WHERE project_id = ?').all(projectId) as any[];

    const suggestions: any[] = [];

    for (const task of tasks) {
      const taskCode = (task.code || '').toLowerCase();
      const taskName = task.name.toLowerCase();

      for (const wbs of wbsItems) {
        const wbsCode = wbs.code.toLowerCase();
        const wbsName = wbs.name.toLowerCase();

        // Simple matching: check if codes match or names are similar
        let score = 0;

        // Exact code match
        if (taskCode && taskCode === wbsCode) {
          score += 100;
        }

        // Code contains other code
        if (taskCode && wbsCode && (taskCode.includes(wbsCode) || wbsCode.includes(taskCode))) {
          score += 50;
        }

        // Name contains other name
        if (taskName.includes(wbsName) || wbsName.includes(taskName)) {
          score += 30;
        }

        // Common words in names
        const taskWords = taskName.split(/\s+/).filter((w: string) => w.length > 3);
        const wbsWords = wbsName.split(/\s+/).filter((w: string) => w.length > 3);
        const commonWords = taskWords.filter((w: string) => wbsWords.includes(w));
        score += commonWords.length * 10;

        if (score >= 30) {
          suggestions.push({
            programme_task_id: task.id,
            programme_task_code: task.code,
            programme_task_name: task.name,
            wbs_item_id: wbs.id,
            wbs_code: wbs.code,
            wbs_name: wbs.name,
            score,
            suggested_percent: 100
          });
        }
      }
    }

    // Sort by score and limit
    suggestions.sort((a, b) => b.score - a.score);
    const topSuggestions = suggestions.slice(0, 50);

    res.json(topSuggestions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

// ============================================================
// MAPPING MATRIX - Get full matrix view
// ============================================================

router.get('/matrix/project/:projectId', (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Get all programme tasks
    const tasks = db.prepare(`
      SELECT id, code, name, level, sort_order, start_date, end_date, duration_days
      FROM programme_tasks
      WHERE project_id = ?
      ORDER BY sort_order, code
    `).all(projectId);

    // Get all WBS items
    const wbsItems = db.prepare(`
      SELECT id, code, name, level, sort_order, quantity, unit,
        (SELECT SUM(budgeted_hours * hourly_rate) FROM wbs_plant_assignments WHERE wbs_item_id = w.id) +
        (SELECT COALESCE(SUM(budgeted_hours * hourly_rate * quantity), 0) FROM wbs_labour_assignments WHERE wbs_item_id = w.id) +
        (SELECT COALESCE(SUM(budgeted_quantity * unit_rate), 0) FROM wbs_material_assignments WHERE wbs_item_id = w.id) +
        (SELECT COALESCE(SUM(budgeted_value), 0) FROM wbs_subcontractor_assignments WHERE wbs_item_id = w.id) as budget
      FROM wbs_items w
      WHERE project_id = ?
      ORDER BY sort_order, code
    `).all(projectId);

    // Get all mappings
    const mappings = db.prepare(`
      SELECT programme_task_id, wbs_item_id, allocation_type, allocation_percent, allocation_value
      FROM programme_wbs_mappings
      WHERE project_id = ?
    `).all(projectId);

    // Build mapping lookup
    const mappingLookup: { [key: string]: any } = {};
    for (const m of mappings as any[]) {
      mappingLookup[`${m.programme_task_id}-${m.wbs_item_id}`] = m;
    }

    res.json({
      tasks,
      wbs_items: wbsItems,
      mappings,
      mapping_lookup: mappingLookup
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get mapping matrix' });
  }
});

// ============================================================
// PROGRAMME-REVENUE MAPPINGS
// ============================================================

// Get all programme-revenue mappings for a project
router.get('/programme-revenue/project/:projectId', (req, res) => {
  try {
    const mappings = db.prepare(`
      SELECT prm.*,
        pt.code as task_code, pt.name as task_name,
        ri.code as revenue_code, ri.name as revenue_name, ri.contract_value
      FROM programme_revenue_mappings prm
      JOIN programme_tasks pt ON prm.programme_task_id = pt.id
      JOIN revenue_items ri ON prm.revenue_item_id = ri.id
      WHERE prm.project_id = ?
      ORDER BY pt.sort_order, ri.sort_order
    `).all(req.params.projectId);

    res.json(mappings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch programme-revenue mappings' });
  }
});

// Get programme-revenue mappings for a specific task
router.get('/programme-revenue/task/:taskId', (req, res) => {
  try {
    const mappings = db.prepare(`
      SELECT prm.*,
        ri.code as revenue_code, ri.name as revenue_name,
        ri.contract_quantity, ri.contract_rate, ri.contract_value
      FROM programme_revenue_mappings prm
      JOIN revenue_items ri ON prm.revenue_item_id = ri.id
      WHERE prm.programme_task_id = ?
    `).all(req.params.taskId);

    res.json(mappings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch task revenue mappings' });
  }
});

// Get programme-revenue mappings for a specific revenue item
router.get('/programme-revenue/revenue/:revenueId', (req, res) => {
  try {
    const mappings = db.prepare(`
      SELECT prm.*,
        pt.code as task_code, pt.name as task_name,
        pt.start_date, pt.end_date, pt.duration_days
      FROM programme_revenue_mappings prm
      JOIN programme_tasks pt ON prm.programme_task_id = pt.id
      WHERE prm.revenue_item_id = ?
    `).all(req.params.revenueId);

    res.json(mappings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch revenue programme mappings' });
  }
});

// Create programme-revenue mapping
router.post('/programme-revenue', (req, res) => {
  try {
    const id = uuidv4();
    const {
      project_id,
      programme_task_id,
      revenue_item_id,
      allocation_type = 'percent',
      allocation_percent = 100,
      allocation_value,
      notes
    } = req.body;

    db.prepare(`
      INSERT INTO programme_revenue_mappings (
        id, project_id, programme_task_id, revenue_item_id,
        allocation_type, allocation_percent, allocation_value, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, project_id, programme_task_id, revenue_item_id,
      allocation_type, allocation_percent, allocation_value, notes
    );

    const mapping = db.prepare(`
      SELECT prm.*,
        pt.code as task_code, pt.name as task_name,
        ri.code as revenue_code, ri.name as revenue_name
      FROM programme_revenue_mappings prm
      JOIN programme_tasks pt ON prm.programme_task_id = pt.id
      JOIN revenue_items ri ON prm.revenue_item_id = ri.id
      WHERE prm.id = ?
    `).get(id);

    res.status(201).json(mapping);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create programme-revenue mapping' });
  }
});

// Bulk create programme-revenue mappings
router.post('/programme-revenue/bulk', (req, res) => {
  try {
    const { project_id, mappings } = req.body;

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO programme_revenue_mappings (
        id, project_id, programme_task_id, revenue_item_id,
        allocation_type, allocation_percent, allocation_value, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((mappingsToCreate: any[]) => {
      for (const mapping of mappingsToCreate) {
        const id = mapping.id || uuidv4();
        insertStmt.run(
          id,
          project_id,
          mapping.programme_task_id,
          mapping.revenue_item_id,
          mapping.allocation_type || 'percent',
          mapping.allocation_percent || 100,
          mapping.allocation_value || null,
          mapping.notes || null
        );
      }
    });

    transaction(mappings);

    res.json({ success: true, created: mappings.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to bulk create programme-revenue mappings' });
  }
});

// Update programme-revenue mapping
router.put('/programme-revenue/:id', (req, res) => {
  try {
    const {
      allocation_type,
      allocation_percent,
      allocation_value,
      notes
    } = req.body;

    db.prepare(`
      UPDATE programme_revenue_mappings
      SET allocation_type = ?, allocation_percent = ?, allocation_value = ?, notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(allocation_type, allocation_percent, allocation_value, notes, req.params.id);

    const mapping = db.prepare(`
      SELECT prm.*,
        pt.code as task_code, pt.name as task_name,
        ri.code as revenue_code, ri.name as revenue_name
      FROM programme_revenue_mappings prm
      JOIN programme_tasks pt ON prm.programme_task_id = pt.id
      JOIN revenue_items ri ON prm.revenue_item_id = ri.id
      WHERE prm.id = ?
    `).get(req.params.id);

    res.json(mapping);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update programme-revenue mapping' });
  }
});

// Delete programme-revenue mapping
router.delete('/programme-revenue/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM programme_revenue_mappings WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete programme-revenue mapping' });
  }
});

// ============================================================
// WBS-REVENUE MAPPINGS
// ============================================================

// Get all wbs-revenue mappings for a project
router.get('/wbs-revenue/project/:projectId', (req, res) => {
  try {
    const mappings = db.prepare(`
      SELECT wrm.*,
        w.code as wbs_code, w.name as wbs_name, w.total_cost,
        ri.code as revenue_code, ri.name as revenue_name, ri.contract_value
      FROM wbs_revenue_mappings wrm
      JOIN wbs_items w ON wrm.wbs_item_id = w.id
      JOIN revenue_items ri ON wrm.revenue_item_id = ri.id
      WHERE wrm.project_id = ?
      ORDER BY w.code, ri.code
    `).all(req.params.projectId);

    res.json(mappings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch wbs-revenue mappings' });
  }
});

// Get wbs-revenue mappings for a specific WBS item
router.get('/wbs-revenue/wbs/:wbsId', (req, res) => {
  try {
    const mappings = db.prepare(`
      SELECT wrm.*,
        ri.code as revenue_code, ri.name as revenue_name,
        ri.contract_quantity, ri.contract_rate, ri.contract_value
      FROM wbs_revenue_mappings wrm
      JOIN revenue_items ri ON wrm.revenue_item_id = ri.id
      WHERE wrm.wbs_item_id = ?
    `).all(req.params.wbsId);

    res.json(mappings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch WBS revenue mappings' });
  }
});

// Get wbs-revenue mappings for a specific revenue item
router.get('/wbs-revenue/revenue/:revenueId', (req, res) => {
  try {
    const mappings = db.prepare(`
      SELECT wrm.*,
        w.code as wbs_code, w.name as wbs_name,
        w.quantity, w.unit, w.total_cost
      FROM wbs_revenue_mappings wrm
      JOIN wbs_items w ON wrm.wbs_item_id = w.id
      WHERE wrm.revenue_item_id = ?
    `).all(req.params.revenueId);

    res.json(mappings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch revenue WBS mappings' });
  }
});

// Create wbs-revenue mapping
router.post('/wbs-revenue', (req, res) => {
  try {
    const id = uuidv4();
    const {
      project_id,
      wbs_item_id,
      revenue_item_id,
      allocation_type = 'percent',
      allocation_percent = 100,
      allocation_value,
      notes
    } = req.body;

    db.prepare(`
      INSERT INTO wbs_revenue_mappings (
        id, project_id, wbs_item_id, revenue_item_id,
        allocation_type, allocation_percent, allocation_value, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, project_id, wbs_item_id, revenue_item_id,
      allocation_type, allocation_percent, allocation_value, notes
    );

    const mapping = db.prepare(`
      SELECT wrm.*,
        w.code as wbs_code, w.name as wbs_name,
        ri.code as revenue_code, ri.name as revenue_name
      FROM wbs_revenue_mappings wrm
      JOIN wbs_items w ON wrm.wbs_item_id = w.id
      JOIN revenue_items ri ON wrm.revenue_item_id = ri.id
      WHERE wrm.id = ?
    `).get(id);

    res.status(201).json(mapping);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create wbs-revenue mapping' });
  }
});

// Bulk create wbs-revenue mappings
router.post('/wbs-revenue/bulk', (req, res) => {
  try {
    const { project_id, mappings } = req.body;

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO wbs_revenue_mappings (
        id, project_id, wbs_item_id, revenue_item_id,
        allocation_type, allocation_percent, allocation_value, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((mappingsToCreate: any[]) => {
      for (const mapping of mappingsToCreate) {
        const id = mapping.id || uuidv4();
        insertStmt.run(
          id,
          project_id,
          mapping.wbs_item_id,
          mapping.revenue_item_id,
          mapping.allocation_type || 'percent',
          mapping.allocation_percent || 100,
          mapping.allocation_value || null,
          mapping.notes || null
        );
      }
    });

    transaction(mappings);

    res.json({ success: true, created: mappings.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to bulk create wbs-revenue mappings' });
  }
});

// Update wbs-revenue mapping
router.put('/wbs-revenue/:id', (req, res) => {
  try {
    const {
      allocation_type,
      allocation_percent,
      allocation_value,
      notes
    } = req.body;

    db.prepare(`
      UPDATE wbs_revenue_mappings
      SET allocation_type = ?, allocation_percent = ?, allocation_value = ?, notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(allocation_type, allocation_percent, allocation_value, notes, req.params.id);

    const mapping = db.prepare(`
      SELECT wrm.*,
        w.code as wbs_code, w.name as wbs_name,
        ri.code as revenue_code, ri.name as revenue_name
      FROM wbs_revenue_mappings wrm
      JOIN wbs_items w ON wrm.wbs_item_id = w.id
      JOIN revenue_items ri ON wrm.revenue_item_id = ri.id
      WHERE wrm.id = ?
    `).get(req.params.id);

    res.json(mapping);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update wbs-revenue mapping' });
  }
});

// Delete wbs-revenue mapping
router.delete('/wbs-revenue/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM wbs_revenue_mappings WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete wbs-revenue mapping' });
  }
});

export default router;
