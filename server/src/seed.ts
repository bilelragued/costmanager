import { v4 as uuidv4 } from 'uuid';
import db from './database';

// Helper to generate random date in range
function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

// Helper to add days to date
function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Helper to generate random number in range
function randomNum(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper to generate random float
function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

export function seedDatabase() {
  console.log('Starting database seeding...');

  // Clear existing data
  console.log('Clearing existing data...');
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
    DELETE FROM projects WHERE id NOT IN (SELECT DISTINCT project_id FROM cashflow_rules WHERE project_id IS NOT NULL);
    DELETE FROM crew_template_members;
    DELETE FROM crew_templates;
    DELETE FROM plant_types;
    DELETE FROM labour_types;
    DELETE FROM material_types;
    DELETE FROM subcontractor_types;
  `);

  // Seed Resource Libraries
  console.log('Seeding resource libraries...');

  // Plant Types
  const plantTypes = [
    { id: uuidv4(), code: 'EXC20T', description: '20T Excavator', ownership_type: 'owned', hourly_rate: 120, hire_rate: 0, requires_operator: 1, mobilisation_cost: 800 },
    { id: uuidv4(), code: 'EXC30T', description: '30T Excavator', ownership_type: 'hired', hourly_rate: 0, hire_rate: 180, requires_operator: 1, mobilisation_cost: 1200 },
    { id: uuidv4(), code: 'DUMP15T', description: '15T Dump Truck', ownership_type: 'owned', hourly_rate: 95, hire_rate: 0, requires_operator: 1, mobilisation_cost: 600 },
    { id: uuidv4(), code: 'ROLLER10T', description: '10T Roller', ownership_type: 'hired', hourly_rate: 0, hire_rate: 110, requires_operator: 1, mobilisation_cost: 500 },
    { id: uuidv4(), code: 'GRADER', description: 'Motor Grader 140M', ownership_type: 'owned', hourly_rate: 150, hire_rate: 0, requires_operator: 1, mobilisation_cost: 1500 },
    { id: uuidv4(), code: 'LOADER', description: 'Front End Loader', ownership_type: 'owned', hourly_rate: 105, hire_rate: 0, requires_operator: 1, mobilisation_cost: 700 },
    { id: uuidv4(), code: 'PAVER', description: 'Asphalt Paver', ownership_type: 'hired', hourly_rate: 0, hire_rate: 200, requires_operator: 1, mobilisation_cost: 2000 },
    { id: uuidv4(), code: 'COMPACTOR', description: 'Plate Compactor', ownership_type: 'owned', hourly_rate: 15, hire_rate: 0, requires_operator: 0, mobilisation_cost: 0 },
  ];
  plantTypes.forEach(p => {
    db.prepare(`INSERT INTO plant_types (id, code, description, ownership_type, hourly_rate, hire_rate, requires_operator, mobilisation_cost)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(p.id, p.code, p.description, p.ownership_type, p.hourly_rate, p.hire_rate, p.requires_operator, p.mobilisation_cost);
  });

  // Labour Types
  const labourTypes = [
    { id: uuidv4(), code: 'PM', role: 'Project Manager', hourly_rate: 95, overtime_rate_1_5: 142.5, overtime_rate_2: 190 },
    { id: uuidv4(), code: 'ENGR', role: 'Site Engineer', hourly_rate: 75, overtime_rate_1_5: 112.5, overtime_rate_2: 150 },
    { id: uuidv4(), code: 'FMAN', role: 'Foreman', hourly_rate: 65, overtime_rate_1_5: 97.5, overtime_rate_2: 130 },
    { id: uuidv4(), code: 'LEAD', role: 'Leading Hand', hourly_rate: 55, overtime_rate_1_5: 82.5, overtime_rate_2: 110 },
    { id: uuidv4(), code: 'OPER', role: 'Plant Operator', hourly_rate: 52, overtime_rate_1_5: 78, overtime_rate_2: 104 },
    { id: uuidv4(), code: 'LABOUR', role: 'General Labourer', hourly_rate: 42, overtime_rate_1_5: 63, overtime_rate_2: 84 },
    { id: uuidv4(), code: 'TRAFFIC', role: 'Traffic Controller', hourly_rate: 48, overtime_rate_1_5: 72, overtime_rate_2: 96 },
    { id: uuidv4(), code: 'SURVEYOR', role: 'Surveyor', hourly_rate: 70, overtime_rate_1_5: 105, overtime_rate_2: 140 },
  ];
  labourTypes.forEach(l => {
    db.prepare(`INSERT INTO labour_types (id, code, role, hourly_rate, overtime_rate_1_5, overtime_rate_2)
                VALUES (?, ?, ?, ?, ?, ?)`).run(l.id, l.code, l.role, l.hourly_rate, l.overtime_rate_1_5, l.overtime_rate_2);
  });

  // Material Types
  const materialTypes = [
    { id: uuidv4(), code: 'AP20', description: 'AP20 Basecourse', unit: 'm3', base_rate: 35, lead_time_days: 2 },
    { id: uuidv4(), code: 'AP40', description: 'AP40 Subbase', unit: 'm3', base_rate: 28, lead_time_days: 2 },
    { id: uuidv4(), code: 'AC14', description: 'AC14 Asphalt', unit: 'tonne', base_rate: 145, lead_time_days: 3 },
    { id: uuidv4(), code: 'CONC32', description: '32MPa Concrete', unit: 'm3', base_rate: 280, lead_time_days: 1 },
    { id: uuidv4(), code: 'REBAR', description: 'Steel Reinforcement', unit: 'tonne', base_rate: 2200, lead_time_days: 7 },
    { id: uuidv4(), code: 'PIPE300', description: '300mm Stormwater Pipe', unit: 'm', base_rate: 85, lead_time_days: 5 },
    { id: uuidv4(), code: 'PIPE450', description: '450mm Stormwater Pipe', unit: 'm', base_rate: 125, lead_time_days: 5 },
    { id: uuidv4(), code: 'TOPSOIL', description: 'Topsoil', unit: 'm3', base_rate: 45, lead_time_days: 2 },
    { id: uuidv4(), code: 'GEOTEX', description: 'Geotextile Fabric', unit: 'm2', base_rate: 8.5, lead_time_days: 3 },
  ];
  materialTypes.forEach(m => {
    db.prepare(`INSERT INTO material_types (id, code, description, unit, base_rate, lead_time_days)
                VALUES (?, ?, ?, ?, ?, ?)`).run(m.id, m.code, m.description, m.unit, m.base_rate, m.lead_time_days);
  });

  // Subcontractor Types
  const subcontractorTypes = [
    { id: uuidv4(), code: 'ELEC', trade: 'Electrical', rate_type: 'lump_sum', default_rate: 25000, retention_percent: 5, payment_terms_days: 30 },
    { id: uuidv4(), code: 'PAINT', trade: 'Line Marking', rate_type: 'measure_value', default_rate: 12, retention_percent: 5, payment_terms_days: 30 },
    { id: uuidv4(), code: 'FENCE', trade: 'Fencing', rate_type: 'measure_value', default_rate: 85, retention_percent: 5, payment_terms_days: 30 },
    { id: uuidv4(), code: 'LANDSCAPE', trade: 'Landscaping', rate_type: 'lump_sum', default_rate: 35000, retention_percent: 5, payment_terms_days: 30 },
    { id: uuidv4(), code: 'SIGNALS', trade: 'Traffic Signals', rate_type: 'lump_sum', default_rate: 120000, retention_percent: 10, payment_terms_days: 45 },
  ];
  subcontractorTypes.forEach(s => {
    db.prepare(`INSERT INTO subcontractor_types (id, code, trade, rate_type, default_rate, retention_percent, payment_terms_days)
                VALUES (?, ?, ?, ?, ?, ?, ?)`).run(s.id, s.code, s.trade, s.rate_type, s.default_rate, s.retention_percent, s.payment_terms_days);
  });

  console.log('Resource libraries seeded successfully');

  // Seed Tenders (20)
  console.log('Seeding 20 tenders...');

  const tenderNames = [
    { name: 'SH1 Peka Peka to Ōtaki Expressway Stage 2', client: 'Waka Kotahi NZTA', value: [95000000, 125000000] },
    { name: 'Auckland Eastern Busway Extension', client: 'Auckland Transport', value: [45000000, 65000000] },
    { name: 'Wellington Mass Rapid Transit - City Centre', client: 'Greater Wellington Regional Council', value: [180000000, 220000000] },
    { name: 'Christchurch Northern Corridor - Cranford St', client: 'Waka Kotahi NZTA', value: [35000000, 48000000] },
    { name: 'Hamilton Ring Road Section 4', client: 'Waka Kotahi NZTA', value: [28000000, 38000000] },
    { name: 'Tauranga Cameron Road Upgrade', client: 'Tauranga City Council', value: [22000000, 32000000] },
    { name: 'Dunedin Hospital Access Road', client: 'NZTA / Southern DHB', value: [15000000, 22000000] },
    { name: 'Queenstown Arterial Stage 3', client: 'Queenstown Lakes District Council', value: [42000000, 58000000] },
    { name: 'Palmerston North Regional Freight Ring Road', client: 'Waka Kotahi NZTA', value: [55000000, 72000000] },
    { name: 'Nelson Tahunanui to Airport Link', client: 'Nelson City Council', value: [18000000, 26000000] },
    { name: 'New Plymouth Inglewood Bypass', client: 'Waka Kotahi NZTA', value: [32000000, 44000000] },
    { name: 'Napier Pandora Road Industrial Access', client: 'Napier City Council', value: [12000000, 18000000] },
    { name: 'Whangarei Port Road Widening', client: 'Northland Transportation Alliance', value: [24000000, 34000000] },
    { name: 'Invercargill Tay Street Reconstruction', client: 'Invercargill City Council', value: [8500000, 12000000] },
    { name: 'Rotorua Eastern Arterial Extension', client: 'Rotorua Lakes Council', value: [28000000, 38000000] },
    { name: 'Gisborne State Highway 35 Realignment', client: 'Waka Kotahi NZTA', value: [16000000, 24000000] },
    { name: 'Timaru Main South Road Upgrade', client: 'Canterbury Regional Council', value: [14000000, 20000000] },
    { name: 'Westport Coal Town Road Sealing Project', client: 'Buller District Council', value: [6500000, 9500000] },
    { name: 'Blenheim Taylor River Crossing', client: 'Marlborough District Council', value: [21000000, 30000000] },
    { name: 'Greymouth Cobden Bridge Approaches', client: 'Grey District Council', value: [9500000, 14000000] },
  ];

  const tenders = tenderNames.map((t, idx) => ({
    id: uuidv4(),
    code: `TND-2024-${String(idx + 1).padStart(3, '0')}`,
    name: t.name,
    client: t.client,
    status: 'tender',
    contract_value: randomFloat(t.value[0], t.value[1], 0),
    retention_percent: 5,
    payment_terms_days: 30,
    contingency_percent: randomFloat(5, 8),
    overhead_percent: randomFloat(7, 10),
    margin_percent: randomFloat(4, 8),
  }));

  tenders.forEach(t => {
    db.prepare(`INSERT INTO projects (id, code, name, client, status, contract_value, retention_percent, payment_terms_days, contingency_percent, overhead_percent, margin_percent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      t.id, t.code, t.name, t.client, t.status, t.contract_value, t.retention_percent, t.payment_terms_days, t.contingency_percent, t.overhead_percent, t.margin_percent
    );
  });

  console.log('Tenders seeded successfully');

  // Seed Active Projects (10 at different stages)
  console.log('Seeding 10 active projects...');

  const activeProjectData = [
    { name: 'Auckland Southern Motorway Widening SH1', client: 'Waka Kotahi NZTA', value: 85000000, startOffset: -450, duration: 730, completion: 0.65 },
    { name: 'Wellington Urban Cycleway - Island Bay', client: 'Wellington City Council', value: 12500000, startOffset: -180, duration: 365, completion: 0.85 },
    { name: 'Christchurch Avonside Road Rebuild', client: 'Christchurch City Council', value: 32000000, startOffset: -90, duration: 450, completion: 0.25 },
    { name: 'Hamilton Te Rapa Bypass Stage 2', client: 'Hamilton City Council', value: 48000000, startOffset: -240, duration: 550, completion: 0.50 },
    { name: 'Tauranga Route K Arterial', client: 'Tauranga City Council', value: 67000000, startOffset: -600, duration: 900, completion: 0.75 },
    { name: 'Queenstown Frankton-Ladies Mile Link', client: 'QLDC / NZTA', value: 54000000, startOffset: -150, duration: 480, completion: 0.35 },
    { name: 'Dunedin One Way System Improvements', client: 'Dunedin City Council', value: 18500000, startOffset: -60, duration: 300, completion: 0.20 },
    { name: 'Nelson Rocks Road Resilience Works', client: 'Nelson City Council', value: 9200000, startOffset: -280, duration: 365, completion: 0.90 },
    { name: 'Napier Awatoto Road Raising - Resilience', client: 'Napier City Council', value: 25000000, startOffset: -420, duration: 600, completion: 0.72 },
    { name: 'New Plymouth Surf Highway 45 Upgrade', client: 'New Plymouth District Council', value: 38000000, startOffset: -10, duration: 540, completion: 0.05 },
  ];

  const projects = activeProjectData.map((p, idx) => {
    const startDate = addDays(new Date().toISOString().split('T')[0], p.startOffset);
    const endDate = addDays(startDate, p.duration);
    return {
      id: uuidv4(),
      code: `PRJ-2024-${String(idx + 1).padStart(3, '0')}`,
      name: p.name,
      client: p.client,
      status: 'active',
      start_date: startDate,
      end_date: endDate,
      contract_value: p.value,
      retention_percent: 5,
      payment_terms_days: 30,
      contingency_percent: 5,
      overhead_percent: 8,
      margin_percent: 6,
      completion: p.completion,
      duration: p.duration,
      startOffset: p.startOffset,
    };
  });

  projects.forEach(p => {
    db.prepare(`INSERT INTO projects (id, code, name, client, status, start_date, end_date, contract_value, retention_percent, payment_terms_days, contingency_percent, overhead_percent, margin_percent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      p.id, p.code, p.name, p.client, p.status, p.start_date, p.end_date, p.contract_value, p.retention_percent, p.payment_terms_days, p.contingency_percent, p.overhead_percent, p.margin_percent
    );
  });

  console.log('Active projects seeded successfully');

  // Add WBS structure and actuals to each active project
  console.log('Adding WBS items and actuals to projects...');

  projects.forEach((project, projIdx) => {
    console.log(`  Processing ${project.name}...`);

    // Create typical road construction WBS
    const wbsItems = [
      // Level 1 - Major phases
      { code: '1.0', name: 'Mobilisation & Site Establishment', level: 1, parent: null, quantity: 1, unit: 'LS', rate: project.contract_value * 0.05 },
      { code: '2.0', name: 'Earthworks', level: 1, parent: null, quantity: 15000, unit: 'm3', rate: project.contract_value * 0.25 / 15000 },
      { code: '3.0', name: 'Drainage', level: 1, parent: null, quantity: 800, unit: 'm', rate: project.contract_value * 0.15 / 800 },
      { code: '4.0', name: 'Pavement', level: 1, parent: null, quantity: 2500, unit: 'm2', rate: project.contract_value * 0.30 / 2500 },
      { code: '5.0', name: 'Structures', level: 1, parent: null, quantity: 1, unit: 'LS', rate: project.contract_value * 0.15 },
      { code: '6.0', name: 'Finishing Works', level: 1, parent: null, quantity: 1, unit: 'LS', rate: project.contract_value * 0.10 },
    ];

    const createdWbs: any[] = [];
    wbsItems.forEach((wbs, idx) => {
      const wbsId = uuidv4();
      const taskDuration = Math.floor(project.duration / 6);
      const taskStart = addDays(project.start_date, idx * taskDuration);
      const taskEnd = addDays(taskStart, taskDuration);

      db.prepare(`INSERT INTO wbs_items (id, project_id, parent_id, code, name, level, sort_order, quantity, unit, budgeted_unit_rate, start_date, end_date, duration_days)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        wbsId, project.id, null, wbs.code, wbs.name, wbs.level, idx, wbs.quantity, wbs.unit, wbs.rate, taskStart, taskEnd, taskDuration
      );

      createdWbs.push({ ...wbs, id: wbsId, start_date: taskStart, end_date: taskEnd });

      // Add resource assignments to WBS items
      if (idx === 0) { // Mobilisation
        // Plant: Excavator, Trucks
        db.prepare(`INSERT INTO wbs_plant_assignments (id, wbs_item_id, plant_type_id, budgeted_hours, hourly_rate)
                    VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, plantTypes[0].id, 40, plantTypes[0].hourly_rate);
        db.prepare(`INSERT INTO wbs_plant_assignments (id, wbs_item_id, plant_type_id, budgeted_hours, hourly_rate)
                    VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, plantTypes[2].id, 40, plantTypes[2].hourly_rate);
        // Labour
        db.prepare(`INSERT INTO wbs_labour_assignments (id, wbs_item_id, labour_type_id, budgeted_hours, hourly_rate, quantity)
                    VALUES (?, ?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, labourTypes[0].id, 160, labourTypes[0].hourly_rate, 1);
        db.prepare(`INSERT INTO wbs_labour_assignments (id, wbs_item_id, labour_type_id, budgeted_hours, hourly_rate, quantity)
                    VALUES (?, ?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, labourTypes[5].id, 320, labourTypes[5].hourly_rate, 4);
      } else if (idx === 1) { // Earthworks
        db.prepare(`INSERT INTO wbs_plant_assignments (id, wbs_item_id, plant_type_id, budgeted_hours, hourly_rate)
                    VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, plantTypes[0].id, 1200, plantTypes[0].hourly_rate);
        db.prepare(`INSERT INTO wbs_plant_assignments (id, wbs_item_id, plant_type_id, budgeted_hours, hourly_rate)
                    VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, plantTypes[2].id, 800, plantTypes[2].hourly_rate);
        db.prepare(`INSERT INTO wbs_labour_assignments (id, wbs_item_id, labour_type_id, budgeted_hours, hourly_rate, quantity)
                    VALUES (?, ?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, labourTypes[4].id, 1200, labourTypes[4].hourly_rate, 3);
        db.prepare(`INSERT INTO wbs_labour_assignments (id, wbs_item_id, labour_type_id, budgeted_hours, hourly_rate, quantity)
                    VALUES (?, ?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, labourTypes[5].id, 800, labourTypes[5].hourly_rate, 2);
      } else if (idx === 2) { // Drainage
        db.prepare(`INSERT INTO wbs_plant_assignments (id, wbs_item_id, plant_type_id, budgeted_hours, hourly_rate)
                    VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, plantTypes[0].id, 600, plantTypes[0].hourly_rate);
        db.prepare(`INSERT INTO wbs_material_assignments (id, wbs_item_id, material_type_id, budgeted_quantity, unit_rate)
                    VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, materialTypes[5].id, 400, materialTypes[5].base_rate);
        db.prepare(`INSERT INTO wbs_material_assignments (id, wbs_item_id, material_type_id, budgeted_quantity, unit_rate)
                    VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, materialTypes[6].id, 400, materialTypes[6].base_rate);
        db.prepare(`INSERT INTO wbs_labour_assignments (id, wbs_item_id, labour_type_id, budgeted_hours, hourly_rate, quantity)
                    VALUES (?, ?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, labourTypes[5].id, 1200, labourTypes[5].hourly_rate, 6);
      } else if (idx === 3) { // Pavement
        db.prepare(`INSERT INTO wbs_plant_assignments (id, wbs_item_id, plant_type_id, budgeted_hours, hourly_rate)
                    VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, plantTypes[6].id, 200, plantTypes[6].hire_rate);
        db.prepare(`INSERT INTO wbs_plant_assignments (id, wbs_item_id, plant_type_id, budgeted_hours, hourly_rate)
                    VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, plantTypes[3].id, 400, plantTypes[3].hire_rate);
        db.prepare(`INSERT INTO wbs_material_assignments (id, wbs_item_id, material_type_id, budgeted_quantity, unit_rate)
                    VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, materialTypes[0].id, 800, materialTypes[0].base_rate);
        db.prepare(`INSERT INTO wbs_material_assignments (id, wbs_item_id, material_type_id, budgeted_quantity, unit_rate)
                    VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, materialTypes[2].id, 500, materialTypes[2].base_rate);
        db.prepare(`INSERT INTO wbs_labour_assignments (id, wbs_item_id, labour_type_id, budgeted_hours, hourly_rate, quantity)
                    VALUES (?, ?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, labourTypes[4].id, 400, labourTypes[4].hourly_rate, 2);
      } else if (idx === 4) { // Structures
        db.prepare(`INSERT INTO wbs_material_assignments (id, wbs_item_id, material_type_id, budgeted_quantity, unit_rate)
                    VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, materialTypes[3].id, 450, materialTypes[3].base_rate);
        db.prepare(`INSERT INTO wbs_material_assignments (id, wbs_item_id, material_type_id, budgeted_quantity, unit_rate)
                    VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, materialTypes[4].id, 45, materialTypes[4].base_rate);
        db.prepare(`INSERT INTO wbs_subcontractor_assignments (id, wbs_item_id, subcontractor_type_id, description, budgeted_value)
                    VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, subcontractorTypes[0].id, 'Street Lighting', 85000);
      } else if (idx === 5) { // Finishing
        db.prepare(`INSERT INTO wbs_subcontractor_assignments (id, wbs_item_id, subcontractor_type_id, description, budgeted_value)
                    VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, subcontractorTypes[1].id, 'Line Marking', 35000);
        db.prepare(`INSERT INTO wbs_subcontractor_assignments (id, wbs_item_id, subcontractor_type_id, description, budgeted_value)
                    VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), wbsId, subcontractorTypes[3].id, 'Landscaping', 45000);
      }
    });

    // Add actual data based on project completion percentage
    const daysElapsed = Math.floor((new Date().getTime() - new Date(project.start_date).getTime()) / (1000 * 60 * 60 * 24));
    const numLogs = Math.min(daysElapsed, Math.floor(project.duration * project.completion));

    // Create daily logs for completed portion
    for (let d = 0; d < numLogs; d += 7) { // One log per week
      const logDate = addDays(project.start_date, d);
      const logId = uuidv4();

      db.prepare(`INSERT INTO daily_logs (id, project_id, log_date, weather, notes)
                  VALUES (?, ?, ?, ?, ?)`).run(
        logId, project.id, logDate,
        ['Fine', 'Overcast', 'Light Rain', 'Sunny'][randomNum(0, 3)],
        'Normal operations'
      );

      // Add some actual hours/materials to random WBS items
      const activeWbs = createdWbs.filter(w => {
        const wbsStart = new Date(w.start_date).getTime();
        const wbsEnd = new Date(w.end_date).getTime();
        const logTime = new Date(logDate).getTime();
        return logTime >= wbsStart && logTime <= wbsEnd;
      });

      if (activeWbs.length > 0) {
        const wbs = activeWbs[randomNum(0, activeWbs.length - 1)];

        // Add actual plant hours
        if (randomNum(0, 1) === 1) {
          db.prepare(`INSERT INTO actual_plant_hours (id, daily_log_id, wbs_item_id, plant_type_id, hours, notes)
                      VALUES (?, ?, ?, ?, ?, ?)`).run(
            uuidv4(), logId, wbs.id, plantTypes[randomNum(0, plantTypes.length - 1)].id, randomFloat(6, 10), 'Normal operations'
          );
        }

        // Add actual labour hours
        db.prepare(`INSERT INTO actual_labour_hours (id, daily_log_id, wbs_item_id, labour_type_id, hours, workers, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
          uuidv4(), logId, wbs.id, labourTypes[randomNum(0, labourTypes.length - 1)].id, 8, randomNum(2, 6), 'Normal operations'
        );

        // Add actual quantities
        const completedQty = wbs.quantity * randomFloat(0.01, 0.05);
        db.prepare(`INSERT INTO actual_quantities (id, daily_log_id, wbs_item_id, quantity_completed, notes)
                    VALUES (?, ?, ?, ?, ?)`).run(
          uuidv4(), logId, wbs.id, completedQty, `${wbs.name} progress`
        );
      }
    }

    // Add progress claims based on completion
    const numClaims = Math.floor(project.completion * 12); // Roughly monthly
    for (let c = 0; c < numClaims; c++) {
      const claimId = uuidv4();
      const claimStart = addDays(project.start_date, c * 30);
      const claimEnd = addDays(claimStart, 30);
      const claimValue = project.contract_value * ((c + 1) / 12) * randomFloat(0.08, 0.12);
      const retention = claimValue * (project.retention_percent / 100);

      db.prepare(`INSERT INTO progress_claims (id, project_id, claim_number, claim_period_start, claim_period_end, submitted_date, certified_date, gross_amount, retention_held, this_claim, status)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        claimId, project.id, c + 1, claimStart, claimEnd,
        addDays(claimEnd, 3), addDays(claimEnd, 10),
        claimValue, retention, claimValue - retention,
        c < numClaims - 1 ? 'paid' : 'certified'
      );

      // Add claim line items for each WBS
      createdWbs.forEach(wbs => {
        const thisQty = wbs.quantity * randomFloat(0.08, 0.12);
        db.prepare(`INSERT INTO claim_line_items (id, claim_id, wbs_item_id, contract_quantity, previous_quantity, this_quantity, to_date_quantity, rate, this_value)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          uuidv4(), claimId, wbs.id, wbs.quantity, 0, thisQty, thisQty, wbs.rate, thisQty * wbs.rate
        );
      });
    }

    // Add some variations for mid-stage projects
    if (project.completion > 0.2 && project.completion < 0.8) {
      const numVariations = randomNum(1, 3);
      for (let v = 0; v < numVariations; v++) {
        db.prepare(`INSERT INTO variations (id, project_id, variation_number, description, status, claimed_value, approved_value, submitted_date, approved_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          uuidv4(), project.id, v + 1,
          ['Additional drainage works', 'Unforeseen rock excavation', 'Design change - pavement widening'][v % 3],
          ['approved', 'submitted'][randomNum(0, 1)],
          randomFloat(50000, 200000), randomFloat(40000, 180000),
          addDays(project.start_date, 60 + v * 30),
          addDays(project.start_date, 75 + v * 30)
        );
      }
    }
  });

  console.log('WBS items and actuals seeded successfully');
  console.log('\n=== Database seeding completed successfully! ===');
  console.log(`- 20 tenders created`);
  console.log(`- 10 active projects created with varying completion stages`);
  console.log(`- Resource libraries populated (plant, labour, materials, subcontractors)`);
  console.log(`- WBS structures, resource assignments, daily logs, and progress claims added`);
}

// Run seed if this file is executed directly
if (require.main === module) {
  seedDatabase();
}
