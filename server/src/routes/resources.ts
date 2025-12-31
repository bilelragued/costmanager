import { Router } from 'express';
import db from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============ PLANT TYPES ============

router.get('/plant', (req, res) => {
  try {
    const plants = db.prepare('SELECT * FROM plant_types ORDER BY code').all();
    res.json(plants);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch plant types' });
  }
});

router.post('/plant', (req, res) => {
  try {
    const id = uuidv4();
    const { code, description, ownership_type, hourly_rate, hire_rate, requires_operator, mobilisation_cost } = req.body;

    db.prepare(`
      INSERT INTO plant_types (id, code, description, ownership_type, hourly_rate, hire_rate, requires_operator, mobilisation_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, code, description, ownership_type || 'owned', hourly_rate || 0, hire_rate || 0, requires_operator ? 1 : 0, mobilisation_cost || 0);

    const plant = db.prepare('SELECT * FROM plant_types WHERE id = ?').get(id);
    res.status(201).json(plant);
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Plant code already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create plant type' });
    }
  }
});

router.put('/plant/:id', (req, res) => {
  try {
    const { code, description, ownership_type, hourly_rate, hire_rate, requires_operator, mobilisation_cost } = req.body;

    db.prepare(`
      UPDATE plant_types SET
        code = COALESCE(?, code),
        description = COALESCE(?, description),
        ownership_type = COALESCE(?, ownership_type),
        hourly_rate = COALESCE(?, hourly_rate),
        hire_rate = COALESCE(?, hire_rate),
        requires_operator = COALESCE(?, requires_operator),
        mobilisation_cost = COALESCE(?, mobilisation_cost),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(code, description, ownership_type, hourly_rate, hire_rate, requires_operator ? 1 : 0, mobilisation_cost, req.params.id);

    const plant = db.prepare('SELECT * FROM plant_types WHERE id = ?').get(req.params.id);
    res.json(plant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update plant type' });
  }
});

router.delete('/plant/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM plant_types WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete plant type' });
  }
});

// ============ LABOUR TYPES ============

router.get('/labour', (req, res) => {
  try {
    const labour = db.prepare('SELECT * FROM labour_types ORDER BY code').all();
    res.json(labour);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch labour types' });
  }
});

router.post('/labour', (req, res) => {
  try {
    const id = uuidv4();
    const { code, role, hourly_rate, overtime_rate_1_5, overtime_rate_2 } = req.body;

    db.prepare(`
      INSERT INTO labour_types (id, code, role, hourly_rate, overtime_rate_1_5, overtime_rate_2)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, code, role, hourly_rate || 0, overtime_rate_1_5 || 0, overtime_rate_2 || 0);

    const labour = db.prepare('SELECT * FROM labour_types WHERE id = ?').get(id);
    res.status(201).json(labour);
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Labour code already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create labour type' });
    }
  }
});

router.put('/labour/:id', (req, res) => {
  try {
    const { code, role, hourly_rate, overtime_rate_1_5, overtime_rate_2 } = req.body;

    db.prepare(`
      UPDATE labour_types SET
        code = COALESCE(?, code),
        role = COALESCE(?, role),
        hourly_rate = COALESCE(?, hourly_rate),
        overtime_rate_1_5 = COALESCE(?, overtime_rate_1_5),
        overtime_rate_2 = COALESCE(?, overtime_rate_2),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(code, role, hourly_rate, overtime_rate_1_5, overtime_rate_2, req.params.id);

    const labour = db.prepare('SELECT * FROM labour_types WHERE id = ?').get(req.params.id);
    res.json(labour);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update labour type' });
  }
});

router.delete('/labour/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM labour_types WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete labour type' });
  }
});

// ============ MATERIAL TYPES ============

router.get('/materials', (req, res) => {
  try {
    const materials = db.prepare('SELECT * FROM material_types ORDER BY code').all();
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch material types' });
  }
});

router.post('/materials', (req, res) => {
  try {
    const id = uuidv4();
    const { code, description, unit, base_rate, lead_time_days } = req.body;

    db.prepare(`
      INSERT INTO material_types (id, code, description, unit, base_rate, lead_time_days)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, code, description, unit, base_rate || 0, lead_time_days || 0);

    const material = db.prepare('SELECT * FROM material_types WHERE id = ?').get(id);
    res.status(201).json(material);
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Material code already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create material type' });
    }
  }
});

router.put('/materials/:id', (req, res) => {
  try {
    const { code, description, unit, base_rate, lead_time_days } = req.body;

    db.prepare(`
      UPDATE material_types SET
        code = COALESCE(?, code),
        description = COALESCE(?, description),
        unit = COALESCE(?, unit),
        base_rate = COALESCE(?, base_rate),
        lead_time_days = COALESCE(?, lead_time_days),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(code, description, unit, base_rate, lead_time_days, req.params.id);

    const material = db.prepare('SELECT * FROM material_types WHERE id = ?').get(req.params.id);
    res.json(material);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update material type' });
  }
});

router.delete('/materials/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM material_types WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete material type' });
  }
});

// ============ SUBCONTRACTOR TYPES ============

router.get('/subcontractors', (req, res) => {
  try {
    const subcontractors = db.prepare('SELECT * FROM subcontractor_types ORDER BY code').all();
    res.json(subcontractors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subcontractor types' });
  }
});

router.post('/subcontractors', (req, res) => {
  try {
    const id = uuidv4();
    const { code, trade, rate_type, default_rate, retention_percent, payment_terms_days } = req.body;

    db.prepare(`
      INSERT INTO subcontractor_types (id, code, trade, rate_type, default_rate, retention_percent, payment_terms_days)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, code, trade, rate_type || 'lump_sum', default_rate || 0, retention_percent || 5, payment_terms_days || 30);

    const subcontractor = db.prepare('SELECT * FROM subcontractor_types WHERE id = ?').get(id);
    res.status(201).json(subcontractor);
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Subcontractor code already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create subcontractor type' });
    }
  }
});

router.put('/subcontractors/:id', (req, res) => {
  try {
    const { code, trade, rate_type, default_rate, retention_percent, payment_terms_days } = req.body;

    db.prepare(`
      UPDATE subcontractor_types SET
        code = COALESCE(?, code),
        trade = COALESCE(?, trade),
        rate_type = COALESCE(?, rate_type),
        default_rate = COALESCE(?, default_rate),
        retention_percent = COALESCE(?, retention_percent),
        payment_terms_days = COALESCE(?, payment_terms_days),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(code, trade, rate_type, default_rate, retention_percent, payment_terms_days, req.params.id);

    const subcontractor = db.prepare('SELECT * FROM subcontractor_types WHERE id = ?').get(req.params.id);
    res.json(subcontractor);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update subcontractor type' });
  }
});

router.delete('/subcontractors/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM subcontractor_types WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete subcontractor type' });
  }
});

// ============ CREW TEMPLATES ============

router.get('/crews', (req, res) => {
  try {
    const crews = db.prepare('SELECT * FROM crew_templates ORDER BY name').all();

    // Get members for each crew
    const crewsWithMembers = (crews as any[]).map(crew => {
      const members = db.prepare(`
        SELECT ctm.*, lt.code as labour_code, lt.role as labour_role, lt.hourly_rate
        FROM crew_template_members ctm
        JOIN labour_types lt ON ctm.labour_type_id = lt.id
        WHERE ctm.crew_template_id = ?
      `).all(crew.id);

      return { ...crew, members };
    });

    res.json(crewsWithMembers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch crew templates' });
  }
});

router.post('/crews', (req, res) => {
  try {
    const id = uuidv4();
    const { name, description, members } = req.body;

    db.prepare(`
      INSERT INTO crew_templates (id, name, description)
      VALUES (?, ?, ?)
    `).run(id, name, description);

    if (members && Array.isArray(members)) {
      for (const member of members) {
        db.prepare(`
          INSERT INTO crew_template_members (id, crew_template_id, labour_type_id, quantity)
          VALUES (?, ?, ?, ?)
        `).run(uuidv4(), id, member.labour_type_id, member.quantity || 1);
      }
    }

    const crew = db.prepare('SELECT * FROM crew_templates WHERE id = ?').get(id);
    const crewMembers = db.prepare(`
      SELECT ctm.*, lt.code as labour_code, lt.role as labour_role, lt.hourly_rate
      FROM crew_template_members ctm
      JOIN labour_types lt ON ctm.labour_type_id = lt.id
      WHERE ctm.crew_template_id = ?
    `).all(id);

    res.status(201).json({ ...(crew as object), members: crewMembers });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Crew name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create crew template' });
    }
  }
});

router.delete('/crews/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM crew_templates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete crew template' });
  }
});

export default router;
