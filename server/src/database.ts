import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '..', 'constructflow.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initializeDatabase() {
  db.exec(`
    -- Company Resources (Library)
    CREATE TABLE IF NOT EXISTS plant_types (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      ownership_type TEXT DEFAULT 'owned' CHECK(ownership_type IN ('owned', 'hired')),
      hourly_rate REAL NOT NULL DEFAULT 0,
      hire_rate REAL DEFAULT 0,
      requires_operator INTEGER DEFAULT 1,
      mobilisation_cost REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS labour_types (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      hourly_rate REAL NOT NULL DEFAULT 0,
      overtime_rate_1_5 REAL DEFAULT 0,
      overtime_rate_2 REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS material_types (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      unit TEXT NOT NULL,
      base_rate REAL NOT NULL DEFAULT 0,
      lead_time_days INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subcontractor_types (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      trade TEXT NOT NULL,
      rate_type TEXT DEFAULT 'lump_sum' CHECK(rate_type IN ('lump_sum', 'measure_value', 'hourly')),
      default_rate REAL DEFAULT 0,
      retention_percent REAL DEFAULT 5,
      payment_terms_days INTEGER DEFAULT 30,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Crew Templates
    CREATE TABLE IF NOT EXISTS crew_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS crew_template_members (
      id TEXT PRIMARY KEY,
      crew_template_id TEXT NOT NULL,
      labour_type_id TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (crew_template_id) REFERENCES crew_templates(id) ON DELETE CASCADE,
      FOREIGN KEY (labour_type_id) REFERENCES labour_types(id)
    );

    -- Projects and Tenders
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      client TEXT,
      status TEXT DEFAULT 'tender' CHECK(status IN ('tender', 'active', 'completed', 'cancelled')),
      start_date TEXT,
      end_date TEXT,
      contract_value REAL DEFAULT 0,
      retention_percent REAL DEFAULT 5,
      payment_terms_days INTEGER DEFAULT 30,
      contingency_percent REAL DEFAULT 5,
      overhead_percent REAL DEFAULT 8,
      margin_percent REAL DEFAULT 6,
      original_tender_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Work Breakdown Structure
    CREATE TABLE IF NOT EXISTS wbs_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      parent_id TEXT,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      level INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      quantity REAL DEFAULT 0,
      unit TEXT,
      budgeted_unit_rate REAL DEFAULT 0,
      -- Programme fields
      start_date TEXT,
      end_date TEXT,
      duration_days INTEGER DEFAULT 0,
      predecessor_id TEXT,
      predecessor_lag_days INTEGER DEFAULT 0,
      -- Deliverable fields
      is_payment_milestone INTEGER DEFAULT 0,
      payment_percent REAL DEFAULT 0,
      schedule_of_rates_rate REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES wbs_items(id) ON DELETE CASCADE,
      FOREIGN KEY (predecessor_id) REFERENCES wbs_items(id)
    );

    -- Resource Assignments to WBS
    CREATE TABLE IF NOT EXISTS wbs_plant_assignments (
      id TEXT PRIMARY KEY,
      wbs_item_id TEXT NOT NULL,
      plant_type_id TEXT NOT NULL,
      budgeted_hours REAL DEFAULT 0,
      hourly_rate REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_type_id) REFERENCES plant_types(id)
    );

    CREATE TABLE IF NOT EXISTS wbs_labour_assignments (
      id TEXT PRIMARY KEY,
      wbs_item_id TEXT NOT NULL,
      labour_type_id TEXT NOT NULL,
      budgeted_hours REAL DEFAULT 0,
      hourly_rate REAL DEFAULT 0,
      quantity INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id) ON DELETE CASCADE,
      FOREIGN KEY (labour_type_id) REFERENCES labour_types(id)
    );

    CREATE TABLE IF NOT EXISTS wbs_material_assignments (
      id TEXT PRIMARY KEY,
      wbs_item_id TEXT NOT NULL,
      material_type_id TEXT NOT NULL,
      budgeted_quantity REAL DEFAULT 0,
      unit_rate REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id) ON DELETE CASCADE,
      FOREIGN KEY (material_type_id) REFERENCES material_types(id)
    );

    CREATE TABLE IF NOT EXISTS wbs_subcontractor_assignments (
      id TEXT PRIMARY KEY,
      wbs_item_id TEXT NOT NULL,
      subcontractor_type_id TEXT NOT NULL,
      description TEXT,
      budgeted_value REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id) ON DELETE CASCADE,
      FOREIGN KEY (subcontractor_type_id) REFERENCES subcontractor_types(id)
    );

    -- Actuals / Cost Tracking
    CREATE TABLE IF NOT EXISTS daily_logs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      log_date TEXT NOT NULL,
      weather TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS actual_plant_hours (
      id TEXT PRIMARY KEY,
      daily_log_id TEXT NOT NULL,
      wbs_item_id TEXT NOT NULL,
      plant_type_id TEXT NOT NULL,
      hours REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id),
      FOREIGN KEY (plant_type_id) REFERENCES plant_types(id)
    );

    CREATE TABLE IF NOT EXISTS actual_labour_hours (
      id TEXT PRIMARY KEY,
      daily_log_id TEXT NOT NULL,
      wbs_item_id TEXT NOT NULL,
      labour_type_id TEXT NOT NULL,
      hours REAL DEFAULT 0,
      workers INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id),
      FOREIGN KEY (labour_type_id) REFERENCES labour_types(id)
    );

    CREATE TABLE IF NOT EXISTS actual_materials (
      id TEXT PRIMARY KEY,
      daily_log_id TEXT NOT NULL,
      wbs_item_id TEXT NOT NULL,
      material_type_id TEXT NOT NULL,
      quantity REAL DEFAULT 0,
      unit_cost REAL DEFAULT 0,
      docket_number TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id),
      FOREIGN KEY (material_type_id) REFERENCES material_types(id)
    );

    CREATE TABLE IF NOT EXISTS actual_quantities (
      id TEXT PRIMARY KEY,
      daily_log_id TEXT NOT NULL,
      wbs_item_id TEXT NOT NULL,
      quantity_completed REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id)
    );

    -- Cost Entries (for non-daily tracked costs like invoices)
    CREATE TABLE IF NOT EXISTS cost_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      wbs_item_id TEXT,
      cost_type TEXT NOT NULL CHECK(cost_type IN ('plant', 'labour', 'material', 'subcontractor', 'other')),
      description TEXT,
      invoice_number TEXT,
      invoice_date TEXT,
      amount REAL DEFAULT 0,
      payment_due_date TEXT,
      payment_date TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'paid')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id)
    );

    -- Variations
    CREATE TABLE IF NOT EXISTS variations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      variation_number INTEGER NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'approved', 'rejected')),
      claimed_value REAL DEFAULT 0,
      approved_value REAL DEFAULT 0,
      cost_impact REAL DEFAULT 0,
      submitted_date TEXT,
      approved_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Progress Claims
    CREATE TABLE IF NOT EXISTS progress_claims (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      claim_number INTEGER NOT NULL,
      claim_period_start TEXT NOT NULL,
      claim_period_end TEXT NOT NULL,
      submitted_date TEXT,
      certified_date TEXT,
      paid_date TEXT,
      gross_amount REAL DEFAULT 0,
      retention_held REAL DEFAULT 0,
      previous_claims REAL DEFAULT 0,
      this_claim REAL DEFAULT 0,
      gst_amount REAL DEFAULT 0,
      total_invoice REAL DEFAULT 0,
      certified_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'certified', 'paid')),
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Claim Line Items
    CREATE TABLE IF NOT EXISTS claim_line_items (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      wbs_item_id TEXT NOT NULL,
      contract_quantity REAL DEFAULT 0,
      previous_quantity REAL DEFAULT 0,
      this_quantity REAL DEFAULT 0,
      to_date_quantity REAL DEFAULT 0,
      rate REAL DEFAULT 0,
      this_value REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (claim_id) REFERENCES progress_claims(id) ON DELETE CASCADE,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id)
    );

    -- Cashflow Configuration
    CREATE TABLE IF NOT EXISTS cashflow_rules (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      cost_type TEXT NOT NULL CHECK(cost_type IN ('labour', 'plant_owned', 'plant_hired', 'material', 'subcontractor')),
      payment_timing TEXT NOT NULL DEFAULT 'month_following',
      payment_day INTEGER DEFAULT 20,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Insert default cashflow rules (company-wide, project_id = NULL)
    INSERT OR IGNORE INTO cashflow_rules (id, project_id, cost_type, payment_timing, payment_day, description)
    VALUES
      ('default-labour', NULL, 'labour', 'weekly', 5, 'Labour paid weekly in arrears'),
      ('default-plant-owned', NULL, 'plant_owned', 'monthly', 1, 'Owned plant allocated monthly'),
      ('default-plant-hired', NULL, 'plant_hired', 'month_following', 20, 'Hired plant 20th month following'),
      ('default-material', NULL, 'material', 'month_following', 20, 'Materials 20th month following'),
      ('default-subcontractor', NULL, 'subcontractor', 'month_following', 20, 'Subcontractors 20th month following');

    -- Company Settings
    CREATE TABLE IF NOT EXISTS company_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      company_name TEXT DEFAULT 'My Construction Company',
      default_retention_percent REAL DEFAULT 5,
      default_payment_terms_days INTEGER DEFAULT 30,
      default_contingency_percent REAL DEFAULT 5,
      default_overhead_percent REAL DEFAULT 8,
      default_margin_percent REAL DEFAULT 6,
      head_office_monthly_cost REAL DEFAULT 50000,
      bank_facility_limit REAL DEFAULT 500000,
      gst_rate REAL DEFAULT 0.15,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO company_settings (id) VALUES ('default');
  `);

  console.log('Database initialized successfully');
}

export default db;
