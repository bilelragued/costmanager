import { Router } from 'express';
import db from '../database';

const router = Router();

// Get company settings
router.get('/', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM company_settings WHERE id = ?').get('default');
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update company settings
router.put('/', (req, res) => {
  try {
    const {
      company_name,
      default_retention_percent,
      default_payment_terms_days,
      default_contingency_percent,
      default_overhead_percent,
      default_margin_percent,
      head_office_monthly_cost,
      bank_facility_limit,
      gst_rate
    } = req.body;

    db.prepare(`
      UPDATE company_settings SET
        company_name = COALESCE(?, company_name),
        default_retention_percent = COALESCE(?, default_retention_percent),
        default_payment_terms_days = COALESCE(?, default_payment_terms_days),
        default_contingency_percent = COALESCE(?, default_contingency_percent),
        default_overhead_percent = COALESCE(?, default_overhead_percent),
        default_margin_percent = COALESCE(?, default_margin_percent),
        head_office_monthly_cost = COALESCE(?, head_office_monthly_cost),
        bank_facility_limit = COALESCE(?, bank_facility_limit),
        gst_rate = COALESCE(?, gst_rate),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 'default'
    `).run(
      company_name,
      default_retention_percent,
      default_payment_terms_days,
      default_contingency_percent,
      default_overhead_percent,
      default_margin_percent,
      head_office_monthly_cost,
      bank_facility_limit,
      gst_rate
    );

    const settings = db.prepare('SELECT * FROM company_settings WHERE id = ?').get('default');
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Seed demo data
router.post('/seed-demo', (req, res) => {
  try {
    const { v4: uuidv4 } = require('uuid');

    // Clear existing data
    db.exec(`
      DELETE FROM claim_line_items;
      DELETE FROM progress_claims;
      DELETE FROM variations;
      DELETE FROM cost_entries;
      DELETE FROM actual_quantities;
      DELETE FROM actual_materials;
      DELETE FROM actual_labour_hours;
      DELETE FROM actual_plant_hours;
      DELETE FROM daily_logs;
      DELETE FROM wbs_subcontractor_assignments;
      DELETE FROM wbs_material_assignments;
      DELETE FROM wbs_labour_assignments;
      DELETE FROM wbs_plant_assignments;
      DELETE FROM wbs_items;
      DELETE FROM projects;
      DELETE FROM crew_template_members;
      DELETE FROM crew_templates;
      DELETE FROM subcontractor_types;
      DELETE FROM material_types;
      DELETE FROM labour_types;
      DELETE FROM plant_types;
    `);

    // Seed plant types
    const plantTypes = [
      { id: uuidv4(), code: 'EXC-20T', description: '20T Excavator', hourly_rate: 145, hire_rate: 165, requires_operator: 1, mobilisation_cost: 1500 },
      { id: uuidv4(), code: 'EXC-30T', description: '30T Excavator', hourly_rate: 185, hire_rate: 210, requires_operator: 1, mobilisation_cost: 2500 },
      { id: uuidv4(), code: 'ROLLER-12T', description: '12T Smooth Drum Roller', hourly_rate: 95, hire_rate: 115, requires_operator: 1, mobilisation_cost: 800 },
      { id: uuidv4(), code: 'TRUCK-ART', description: 'Articulated Dump Truck', hourly_rate: 145, hire_rate: 175, requires_operator: 1, mobilisation_cost: 1200 },
      { id: uuidv4(), code: 'LOADER-IT', description: 'IT Loader', hourly_rate: 125, hire_rate: 145, requires_operator: 1, mobilisation_cost: 1000 },
      { id: uuidv4(), code: 'GRADER', description: 'Motor Grader', hourly_rate: 165, hire_rate: 195, requires_operator: 1, mobilisation_cost: 2000 },
    ];

    for (const plant of plantTypes) {
      db.prepare(`
        INSERT INTO plant_types (id, code, description, ownership_type, hourly_rate, hire_rate, requires_operator, mobilisation_cost)
        VALUES (?, ?, ?, 'owned', ?, ?, ?, ?)
      `).run(plant.id, plant.code, plant.description, plant.hourly_rate, plant.hire_rate, plant.requires_operator, plant.mobilisation_cost);
    }

    // Seed labour types
    const labourTypes = [
      { id: uuidv4(), code: 'FOREMAN', role: 'Site Foreman', hourly_rate: 75 },
      { id: uuidv4(), code: 'OPERATOR', role: 'Plant Operator', hourly_rate: 55 },
      { id: uuidv4(), code: 'LABOURER', role: 'General Labourer', hourly_rate: 42 },
      { id: uuidv4(), code: 'ENGINEER', role: 'Site Engineer', hourly_rate: 85 },
      { id: uuidv4(), code: 'SURVEYOR', role: 'Surveyor', hourly_rate: 95 },
    ];

    for (const labour of labourTypes) {
      db.prepare(`
        INSERT INTO labour_types (id, code, role, hourly_rate, overtime_rate_1_5, overtime_rate_2)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(labour.id, labour.code, labour.role, labour.hourly_rate, labour.hourly_rate * 1.5, labour.hourly_rate * 2);
    }

    // Seed material types
    const materialTypes = [
      { id: uuidv4(), code: 'GAP40', description: 'GAP 40 Aggregate', unit: 'm3', base_rate: 45 },
      { id: uuidv4(), code: 'AP20', description: 'AP20 Basecourse', unit: 'm3', base_rate: 55 },
      { id: uuidv4(), code: 'CONC-25', description: 'Concrete 25MPa', unit: 'm3', base_rate: 185 },
      { id: uuidv4(), code: 'CONC-32', description: 'Concrete 32MPa', unit: 'm3', base_rate: 210 },
      { id: uuidv4(), code: 'PIPE-300', description: '300mm RCP Pipe', unit: 'lin.m', base_rate: 125 },
      { id: uuidv4(), code: 'PIPE-450', description: '450mm RCP Pipe', unit: 'lin.m', base_rate: 185 },
      { id: uuidv4(), code: 'GEOTEXT', description: 'Geotextile Fabric', unit: 'm2', base_rate: 8 },
    ];

    for (const material of materialTypes) {
      db.prepare(`
        INSERT INTO material_types (id, code, description, unit, base_rate, lead_time_days)
        VALUES (?, ?, ?, ?, ?, 7)
      `).run(material.id, material.code, material.description, material.unit, material.base_rate);
    }

    // Seed subcontractor types
    const subconTypes = [
      { id: uuidv4(), code: 'ELEC', trade: 'Electrical', rate_type: 'lump_sum', default_rate: 0 },
      { id: uuidv4(), code: 'FENCE', trade: 'Fencing', rate_type: 'measure_value', default_rate: 85 },
      { id: uuidv4(), code: 'LINE', trade: 'Line Marking', rate_type: 'measure_value', default_rate: 12 },
      { id: uuidv4(), code: 'LAND', trade: 'Landscaping', rate_type: 'lump_sum', default_rate: 0 },
      { id: uuidv4(), code: 'TRAFFIC', trade: 'Traffic Management', rate_type: 'hourly', default_rate: 95 },
    ];

    for (const subcon of subconTypes) {
      db.prepare(`
        INSERT INTO subcontractor_types (id, code, trade, rate_type, default_rate, retention_percent, payment_terms_days)
        VALUES (?, ?, ?, ?, ?, 5, 30)
      `).run(subcon.id, subcon.code, subcon.trade, subcon.rate_type, subcon.default_rate);
    }

    // Create demo project
    const projectId = uuidv4();
    const startDate = new Date();
    startDate.setDate(1); // First of current month
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 6);

    db.prepare(`
      INSERT INTO projects (
        id, code, name, client, status, start_date, end_date,
        retention_percent, payment_terms_days, contingency_percent, overhead_percent, margin_percent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      'PRJ-001',
      'Highway 42 Upgrade Stage 1',
      'Regional Council',
      'active',
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
      5, 30, 5, 8, 6
    );

    // Create WBS items
    const wbsItems = [
      { code: '1.0', name: 'Preliminaries', level: 1, quantity: 1, unit: 'LS', rate: 85000, duration: 120, is_milestone: 1 },
      { code: '2.0', name: 'Earthworks', level: 1, quantity: 0, unit: '', rate: 0, duration: 0, is_milestone: 0 },
      { code: '2.1', name: 'Bulk Cut', level: 2, quantity: 25000, unit: 'm3', rate: 12.50, duration: 30, is_milestone: 1 },
      { code: '2.2', name: 'Bulk Fill', level: 2, quantity: 18000, unit: 'm3', rate: 8.50, duration: 25, is_milestone: 1 },
      { code: '2.3', name: 'Subgrade Preparation', level: 2, quantity: 15000, unit: 'm2', rate: 4.20, duration: 15, is_milestone: 1 },
      { code: '3.0', name: 'Drainage', level: 1, quantity: 0, unit: '', rate: 0, duration: 0, is_milestone: 0 },
      { code: '3.1', name: 'Stormwater Pipes', level: 2, quantity: 850, unit: 'lin.m', rate: 245, duration: 25, is_milestone: 1 },
      { code: '3.2', name: 'Manholes', level: 2, quantity: 12, unit: 'each', rate: 4500, duration: 15, is_milestone: 1 },
      { code: '4.0', name: 'Pavement', level: 1, quantity: 0, unit: '', rate: 0, duration: 0, is_milestone: 0 },
      { code: '4.1', name: 'Subbase GAP40', level: 2, quantity: 3500, unit: 'm3', rate: 65, duration: 12, is_milestone: 1 },
      { code: '4.2', name: 'Basecourse AP20', level: 2, quantity: 2200, unit: 'm3', rate: 78, duration: 10, is_milestone: 1 },
      { code: '4.3', name: 'Asphalt Surfacing', level: 2, quantity: 14000, unit: 'm2', rate: 28, duration: 8, is_milestone: 1 },
      { code: '5.0', name: 'Finishing', level: 1, quantity: 0, unit: '', rate: 0, duration: 0, is_milestone: 0 },
      { code: '5.1', name: 'Line Marking', level: 2, quantity: 3200, unit: 'lin.m', rate: 12, duration: 5, is_milestone: 1 },
      { code: '5.2', name: 'Signage', level: 2, quantity: 24, unit: 'each', rate: 850, duration: 3, is_milestone: 1 },
    ];

    let currentDate = new Date(startDate);
    let sortOrder = 0;

    for (const item of wbsItems) {
      const wbsId = uuidv4();
      const itemStart = new Date(currentDate);
      const itemEnd = new Date(currentDate);
      itemEnd.setDate(itemEnd.getDate() + item.duration);

      if (item.duration > 0) {
        currentDate = new Date(itemEnd);
      }

      db.prepare(`
        INSERT INTO wbs_items (
          id, project_id, code, name, level, sort_order, quantity, unit,
          budgeted_unit_rate, start_date, end_date, duration_days,
          is_payment_milestone, schedule_of_rates_rate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        wbsId, projectId, item.code, item.name, item.level, sortOrder++,
        item.quantity, item.unit, item.rate,
        item.duration > 0 ? itemStart.toISOString().split('T')[0] : null,
        item.duration > 0 ? itemEnd.toISOString().split('T')[0] : null,
        item.duration,
        item.is_milestone, item.rate
      );

      // Add resource assignments for key items
      if (item.code === '2.1') { // Bulk Cut
        db.prepare(`INSERT INTO wbs_plant_assignments (id, wbs_item_id, plant_type_id, budgeted_hours, hourly_rate)
          VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, plantTypes[1].id, 200, 185); // 30T Excavator
        db.prepare(`INSERT INTO wbs_plant_assignments (id, wbs_item_id, plant_type_id, budgeted_hours, hourly_rate)
          VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, plantTypes[3].id, 600, 145); // 3x Artic Trucks
        db.prepare(`INSERT INTO wbs_labour_assignments (id, wbs_item_id, labour_type_id, budgeted_hours, hourly_rate, quantity)
          VALUES (?, ?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, labourTypes[0].id, 200, 75, 1); // Foreman
        db.prepare(`INSERT INTO wbs_labour_assignments (id, wbs_item_id, labour_type_id, budgeted_hours, hourly_rate, quantity)
          VALUES (?, ?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, labourTypes[1].id, 200, 55, 4); // Operators
      }

      if (item.code === '3.1') { // Stormwater Pipes
        db.prepare(`INSERT INTO wbs_plant_assignments (id, wbs_item_id, plant_type_id, budgeted_hours, hourly_rate)
          VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, plantTypes[0].id, 150, 145); // 20T Excavator
        db.prepare(`INSERT INTO wbs_material_assignments (id, wbs_item_id, material_type_id, budgeted_quantity, unit_rate)
          VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, materialTypes[4].id, 550, 125); // 300mm pipe
        db.prepare(`INSERT INTO wbs_material_assignments (id, wbs_item_id, material_type_id, budgeted_quantity, unit_rate)
          VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, materialTypes[5].id, 300, 185); // 450mm pipe
        db.prepare(`INSERT INTO wbs_labour_assignments (id, wbs_item_id, labour_type_id, budgeted_hours, hourly_rate, quantity)
          VALUES (?, ?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, labourTypes[2].id, 150, 42, 3); // Labourers
      }

      if (item.code === '4.1') { // Subbase
        db.prepare(`INSERT INTO wbs_material_assignments (id, wbs_item_id, material_type_id, budgeted_quantity, unit_rate)
          VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, materialTypes[0].id, 3500, 45); // GAP40
        db.prepare(`INSERT INTO wbs_plant_assignments (id, wbs_item_id, plant_type_id, budgeted_hours, hourly_rate)
          VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, plantTypes[2].id, 60, 95); // Roller
        db.prepare(`INSERT INTO wbs_plant_assignments (id, wbs_item_id, plant_type_id, budgeted_hours, hourly_rate)
          VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, plantTypes[5].id, 40, 165); // Grader
      }
    }

    // Create a tender
    const tenderId = uuidv4();
    db.prepare(`
      INSERT INTO projects (
        id, code, name, client, status,
        retention_percent, payment_terms_days, contingency_percent, overhead_percent, margin_percent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tenderId,
      'TND-002',
      'Industrial Estate Access Road',
      'Private Developer',
      'tender',
      5, 30, 5, 8, 6
    );

    // Add basic WBS to tender
    const tenderWbs = [
      { code: '1.0', name: 'Preliminaries', quantity: 1, unit: 'LS', rate: 45000, duration: 60 },
      { code: '2.0', name: 'Earthworks', quantity: 8000, unit: 'm3', rate: 11, duration: 20 },
      { code: '3.0', name: 'Drainage', quantity: 320, unit: 'lin.m', rate: 220, duration: 15 },
      { code: '4.0', name: 'Pavement', quantity: 4500, unit: 'm2', rate: 48, duration: 12 },
    ];

    let tenderSort = 0;
    for (const item of tenderWbs) {
      db.prepare(`
        INSERT INTO wbs_items (
          id, project_id, code, name, level, sort_order, quantity, unit,
          duration_days, is_payment_milestone, schedule_of_rates_rate
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, 1, ?)
      `).run(uuidv4(), tenderId, item.code, item.name, tenderSort++, item.quantity, item.unit, item.duration, item.rate);
    }

    res.json({
      success: true,
      message: 'Demo data seeded successfully',
      data: {
        projects: 2,
        plant_types: plantTypes.length,
        labour_types: labourTypes.length,
        material_types: materialTypes.length,
        subcontractor_types: subconTypes.length
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to seed demo data' });
  }
});

export default router;
