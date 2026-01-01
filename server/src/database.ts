import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';

// Use DATABASE_PATH env var for Railway volume, fallback to local path
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'constructflow.db');
const db: DatabaseType = new Database(dbPath);

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
      vendor_name TEXT,
      ai_suggested INTEGER DEFAULT 0,
      suggestion_id TEXT,
      programme_task_id TEXT,
      revenue_item_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id),
      FOREIGN KEY (programme_task_id) REFERENCES programme_tasks(id),
      FOREIGN KEY (revenue_item_id) REFERENCES revenue_items(id),
      FOREIGN KEY (suggestion_id) REFERENCES cost_assignment_suggestions(id)
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

    -- =====================================================
    -- MAPPING MODULE TABLES
    -- Enables flexible many-to-many relationships between
    -- Programme Tasks, WBS Cost Items, Resources, and Actuals
    -- =====================================================

    -- Dedicated Programme Tasks (separate from WBS cost structure)
    CREATE TABLE IF NOT EXISTS programme_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      code TEXT,
      name TEXT NOT NULL,
      description TEXT,
      parent_id TEXT,
      level INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      duration_days INTEGER DEFAULT 0,
      predecessor_id TEXT,
      predecessor_lag_days INTEGER DEFAULT 0,
      percent_complete REAL DEFAULT 0,
      color TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES programme_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (predecessor_id) REFERENCES programme_tasks(id) ON DELETE SET NULL
    );

    -- Programme Task ↔ WBS Item Mappings (many-to-many with allocation)
    CREATE TABLE IF NOT EXISTS programme_wbs_mappings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      programme_task_id TEXT NOT NULL,
      wbs_item_id TEXT NOT NULL,
      allocation_type TEXT DEFAULT 'percent' CHECK(allocation_type IN ('percent', 'fixed_value', 'quantity_based', 'duration_based')),
      allocation_percent REAL DEFAULT 100,
      allocation_value REAL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (programme_task_id) REFERENCES programme_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id) ON DELETE CASCADE,
      UNIQUE(programme_task_id, wbs_item_id)
    );

    -- Resource ↔ Programme Task Mappings (for resource scheduling)
    CREATE TABLE IF NOT EXISTS resource_programme_mappings (
      id TEXT PRIMARY KEY,
      programme_task_id TEXT NOT NULL,
      resource_type TEXT NOT NULL CHECK(resource_type IN ('plant', 'labour', 'material', 'subcontractor')),
      resource_id TEXT NOT NULL,
      planned_quantity REAL DEFAULT 0,
      planned_rate REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (programme_task_id) REFERENCES programme_tasks(id) ON DELETE CASCADE
    );

    -- Cost Allocation Rules (templates for distributing actuals)
    CREATE TABLE IF NOT EXISTS allocation_rules (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      rule_type TEXT NOT NULL DEFAULT 'manual' CHECK(rule_type IN ('manual', 'template', 'auto')),
      source_type TEXT CHECK(source_type IN ('daily_log', 'cost_entry', 'plant_hours', 'labour_hours', 'material', 'quantity')),
      match_criteria TEXT,
      is_active INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Allocation Rule Targets (where costs get distributed)
    CREATE TABLE IF NOT EXISTS allocation_rule_targets (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      wbs_item_id TEXT NOT NULL,
      allocation_type TEXT DEFAULT 'percent' CHECK(allocation_type IN ('percent', 'fixed_value', 'remainder')),
      allocation_percent REAL,
      allocation_value REAL,
      priority INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rule_id) REFERENCES allocation_rules(id) ON DELETE CASCADE,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id) ON DELETE CASCADE
    );

    -- Actual Cost Allocations (realized distribution of actuals to WBS)
    CREATE TABLE IF NOT EXISTS actual_cost_allocations (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL CHECK(source_type IN ('plant_hours', 'labour_hours', 'material', 'quantity', 'cost_entry')),
      source_id TEXT NOT NULL,
      wbs_item_id TEXT NOT NULL,
      programme_task_id TEXT,
      allocated_quantity REAL,
      allocated_value REAL,
      allocation_method TEXT DEFAULT 'manual' CHECK(allocation_method IN ('manual', 'rule', 'auto', 'direct')),
      rule_id TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id) ON DELETE CASCADE,
      FOREIGN KEY (programme_task_id) REFERENCES programme_tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (rule_id) REFERENCES allocation_rules(id) ON DELETE SET NULL
    );

    -- Mapping Templates (reusable mapping patterns)
    CREATE TABLE IF NOT EXISTS mapping_templates (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      template_type TEXT NOT NULL CHECK(template_type IN ('programme_wbs', 'cost_allocation', 'resource_schedule')),
      template_data TEXT NOT NULL,
      is_global INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Mapping Validation Log (tracks unmapped items and validation issues)
    CREATE TABLE IF NOT EXISTS mapping_validation_log (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      validation_type TEXT NOT NULL CHECK(validation_type IN ('unmapped_task', 'unmapped_wbs', 'incomplete_allocation', 'orphaned_actual')),
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      message TEXT,
      severity TEXT DEFAULT 'warning' CHECK(severity IN ('info', 'warning', 'error')),
      resolved INTEGER DEFAULT 0,
      resolved_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- =====================================================
    -- Revenue Items (Schedule of Prices / Pay Items)
    -- =====================================================

    -- Revenue Items Table
    CREATE TABLE IF NOT EXISTS revenue_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      parent_id TEXT,
      level INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      unit TEXT,
      contract_quantity REAL DEFAULT 0,
      contract_rate REAL DEFAULT 0,
      contract_value REAL DEFAULT 0,
      payment_milestone INTEGER DEFAULT 0,
      payment_percent REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES revenue_items(id) ON DELETE CASCADE
    );

    -- Programme Task ↔ Revenue Item Mappings
    CREATE TABLE IF NOT EXISTS programme_revenue_mappings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      programme_task_id TEXT NOT NULL,
      revenue_item_id TEXT NOT NULL,
      allocation_type TEXT DEFAULT 'percent' CHECK(allocation_type IN ('percent', 'fixed_value', 'quantity_based')),
      allocation_percent REAL DEFAULT 100,
      allocation_value REAL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (programme_task_id) REFERENCES programme_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (revenue_item_id) REFERENCES revenue_items(id) ON DELETE CASCADE,
      UNIQUE(programme_task_id, revenue_item_id)
    );

    -- WBS Item ↔ Revenue Item Mappings
    CREATE TABLE IF NOT EXISTS wbs_revenue_mappings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      wbs_item_id TEXT NOT NULL,
      revenue_item_id TEXT NOT NULL,
      allocation_type TEXT DEFAULT 'percent' CHECK(allocation_type IN ('percent', 'fixed_value')),
      allocation_percent REAL DEFAULT 100,
      allocation_value REAL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id) ON DELETE CASCADE,
      FOREIGN KEY (revenue_item_id) REFERENCES revenue_items(id) ON DELETE CASCADE,
      UNIQUE(wbs_item_id, revenue_item_id)
    );

    -- =====================================================
    -- AI Cost Assignment System
    -- =====================================================

    -- AI-Generated Cost Assignment Suggestions
    CREATE TABLE IF NOT EXISTS cost_assignment_suggestions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK(source_type IN ('cost_entry', 'daily_log', 'plant_hours', 'labour_hours', 'material')),
      source_id TEXT NOT NULL,
      transaction_description TEXT,
      vendor_name TEXT,
      transaction_date TEXT,
      amount REAL,
      suggested_wbs_item_id TEXT,
      suggested_programme_task_id TEXT,
      suggested_revenue_item_id TEXT,
      confidence_score REAL DEFAULT 0,
      reasoning TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'modified')),
      user_feedback TEXT,
      accepted_wbs_item_id TEXT,
      accepted_programme_task_id TEXT,
      accepted_revenue_item_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (suggested_wbs_item_id) REFERENCES wbs_items(id) ON DELETE SET NULL,
      FOREIGN KEY (suggested_programme_task_id) REFERENCES programme_tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (suggested_revenue_item_id) REFERENCES revenue_items(id) ON DELETE SET NULL,
      FOREIGN KEY (accepted_wbs_item_id) REFERENCES wbs_items(id) ON DELETE SET NULL,
      FOREIGN KEY (accepted_programme_task_id) REFERENCES programme_tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (accepted_revenue_item_id) REFERENCES revenue_items(id) ON DELETE SET NULL
    );

    -- Assignment Learning History (pattern recognition)
    CREATE TABLE IF NOT EXISTS assignment_learning_history (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      vendor_name TEXT,
      description_pattern TEXT,
      cost_type TEXT,
      wbs_item_id TEXT,
      programme_task_id TEXT,
      revenue_item_id TEXT,
      frequency INTEGER DEFAULT 1,
      last_used TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id) ON DELETE CASCADE,
      FOREIGN KEY (programme_task_id) REFERENCES programme_tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (revenue_item_id) REFERENCES revenue_items(id) ON DELETE SET NULL
    );

    -- Vendor Intelligence Patterns
    CREATE TABLE IF NOT EXISTS vendor_patterns (
      id TEXT PRIMARY KEY,
      vendor_name TEXT NOT NULL,
      primary_cost_type TEXT,
      typical_wbs_codes TEXT,
      typical_programme_codes TEXT,
      typical_revenue_codes TEXT,
      project_id TEXT,
      confidence REAL DEFAULT 0,
      transaction_count INTEGER DEFAULT 1,
      last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Multi-Assignment Support (split costs across multiple targets)
    CREATE TABLE IF NOT EXISTS cost_multi_assignments (
      id TEXT PRIMARY KEY,
      cost_assignment_suggestion_id TEXT NOT NULL,
      wbs_item_id TEXT,
      programme_task_id TEXT,
      revenue_item_id TEXT,
      allocation_percent REAL DEFAULT 100,
      allocation_value REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cost_assignment_suggestion_id) REFERENCES cost_assignment_suggestions(id) ON DELETE CASCADE,
      FOREIGN KEY (wbs_item_id) REFERENCES wbs_items(id) ON DELETE CASCADE,
      FOREIGN KEY (programme_task_id) REFERENCES programme_tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (revenue_item_id) REFERENCES revenue_items(id) ON DELETE SET NULL
    );

  `);

  console.log('Database schema initialized');

  // Create indexes safely (ignore errors for columns that may not exist in older DBs)
  const indexes = [
    // Projects indexes
    'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)',
    'CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at)',
    // WBS indexes
    'CREATE INDEX IF NOT EXISTS idx_wbs_items_project_id ON wbs_items(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_wbs_items_parent_id ON wbs_items(parent_id)',
    'CREATE INDEX IF NOT EXISTS idx_wbs_items_project_level ON wbs_items(project_id, level)',
    // Resource assignment indexes
    'CREATE INDEX IF NOT EXISTS idx_wbs_plant_assignments_wbs_id ON wbs_plant_assignments(wbs_item_id)',
    'CREATE INDEX IF NOT EXISTS idx_wbs_labour_assignments_wbs_id ON wbs_labour_assignments(wbs_item_id)',
    'CREATE INDEX IF NOT EXISTS idx_wbs_material_assignments_wbs_id ON wbs_material_assignments(wbs_item_id)',
    'CREATE INDEX IF NOT EXISTS idx_wbs_subcontractor_assignments_wbs_id ON wbs_subcontractor_assignments(wbs_item_id)',
    // Daily logs indexes
    'CREATE INDEX IF NOT EXISTS idx_daily_logs_project_id ON daily_logs(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(log_date)',
    'CREATE INDEX IF NOT EXISTS idx_actual_plant_hours_log_id ON actual_plant_hours(daily_log_id)',
    'CREATE INDEX IF NOT EXISTS idx_actual_labour_hours_log_id ON actual_labour_hours(daily_log_id)',
    'CREATE INDEX IF NOT EXISTS idx_actual_materials_log_id ON actual_materials(daily_log_id)',
    'CREATE INDEX IF NOT EXISTS idx_actual_quantities_log_id ON actual_quantities(daily_log_id)',
    // Cost entries indexes
    'CREATE INDEX IF NOT EXISTS idx_cost_entries_project_id ON cost_entries(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_cost_entries_wbs_id ON cost_entries(wbs_item_id)',
    'CREATE INDEX IF NOT EXISTS idx_cost_entries_status ON cost_entries(status)',
    // Claims indexes
    'CREATE INDEX IF NOT EXISTS idx_progress_claims_project_id ON progress_claims(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_progress_claims_status ON progress_claims(status)',
    'CREATE INDEX IF NOT EXISTS idx_claim_line_items_claim_id ON claim_line_items(claim_id)',
    // Variations indexes
    'CREATE INDEX IF NOT EXISTS idx_variations_project_id ON variations(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_variations_status ON variations(status)',
  ];

  for (const idx of indexes) {
    try {
      db.exec(idx);
    } catch (e) {
      // Ignore errors for indexes on columns that don't exist yet
    }
  }

  console.log('Database indexes created');
}

export default db;
