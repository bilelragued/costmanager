export interface Project {
  id: string;
  code: string;
  name: string;
  client?: string;
  status: 'tender' | 'active' | 'completed' | 'cancelled';
  start_date?: string;
  end_date?: string;
  contract_value: number;
  retention_percent: number;
  payment_terms_days: number;
  contingency_percent: number;
  overhead_percent: number;
  margin_percent: number;
  created_at: string;
  updated_at: string;
}

export interface WBSItem {
  id: string;
  project_id: string;
  parent_id?: string;
  code: string;
  name: string;
  description?: string;
  level: number;
  sort_order: number;
  quantity: number;
  unit?: string;
  budgeted_unit_rate: number;
  start_date?: string;
  end_date?: string;
  duration_days: number;
  predecessor_id?: string;
  predecessor_lag_days: number;
  is_payment_milestone: boolean;
  payment_percent: number;
  schedule_of_rates_rate: number;
  // Calculated fields
  plant_cost?: number;
  labour_cost?: number;
  material_cost?: number;
  subcontractor_cost?: number;
  total_cost?: number;
  unit_rate_calculated?: number;
}

export interface PlantType {
  id: string;
  code: string;
  description: string;
  ownership_type: 'owned' | 'hired';
  hourly_rate: number;
  hire_rate: number;
  requires_operator: boolean;
  mobilisation_cost: number;
}

export interface LabourType {
  id: string;
  code: string;
  role: string;
  hourly_rate: number;
  overtime_rate_1_5: number;
  overtime_rate_2: number;
}

export interface MaterialType {
  id: string;
  code: string;
  description: string;
  unit: string;
  base_rate: number;
  lead_time_days: number;
}

export interface SubcontractorType {
  id: string;
  code: string;
  trade: string;
  rate_type: 'lump_sum' | 'measure_value' | 'hourly';
  default_rate: number;
  retention_percent: number;
  payment_terms_days: number;
}

export interface PlantAssignment {
  id: string;
  wbs_item_id: string;
  plant_type_id: string;
  budgeted_hours: number;
  hourly_rate: number;
  plant_code?: string;
  plant_description?: string;
}

export interface LabourAssignment {
  id: string;
  wbs_item_id: string;
  labour_type_id: string;
  budgeted_hours: number;
  hourly_rate: number;
  quantity: number;
  labour_code?: string;
  labour_role?: string;
}

export interface MaterialAssignment {
  id: string;
  wbs_item_id: string;
  material_type_id: string;
  budgeted_quantity: number;
  unit_rate: number;
  material_code?: string;
  material_description?: string;
  material_unit?: string;
}

export interface SubcontractorAssignment {
  id: string;
  wbs_item_id: string;
  subcontractor_type_id: string;
  description?: string;
  budgeted_value: number;
  subcontractor_code?: string;
  subcontractor_trade?: string;
}

export interface DailyLog {
  id: string;
  project_id: string;
  log_date: string;
  weather?: string;
  notes?: string;
}

export interface CostEntry {
  id: string;
  project_id: string;
  wbs_item_id?: string;
  cost_type: 'plant' | 'labour' | 'material' | 'subcontractor' | 'other';
  description?: string;
  invoice_number?: string;
  invoice_date?: string;
  amount: number;
  payment_due_date?: string;
  payment_date?: string;
  status: 'pending' | 'approved' | 'paid';
}

export interface Variation {
  id: string;
  project_id: string;
  variation_number: number;
  description: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  claimed_value: number;
  approved_value: number;
  cost_impact: number;
  submitted_date?: string;
  approved_date?: string;
  notes?: string;
}

export interface ProgressClaim {
  id: string;
  project_id: string;
  claim_number: number;
  claim_period_start: string;
  claim_period_end: string;
  submitted_date?: string;
  certified_date?: string;
  paid_date?: string;
  gross_amount: number;
  retention_held: number;
  previous_claims: number;
  this_claim: number;
  gst_amount: number;
  total_invoice: number;
  certified_amount: number;
  status: 'draft' | 'submitted' | 'certified' | 'paid';
  notes?: string;
}

export interface ClaimLineItem {
  id: string;
  claim_id: string;
  wbs_item_id: string;
  contract_quantity: number;
  previous_quantity: number;
  this_quantity: number;
  to_date_quantity: number;
  rate: number;
  this_value: number;
  wbs_code?: string;
  wbs_name?: string;
  unit?: string;
}

export interface CashflowMonth {
  month: string;
  inflows: {
    claims: number;
    retentionRelease: number;
    total: number;
  };
  outflows: {
    labour: number;
    plant: number;
    materials: number;
    subcontractors: number;
    other: number;
    total: number;
  };
  net: number;
  cumulative: number;
}

export interface CostSummary {
  budget: {
    direct_cost: number;
    contingency: number;
    overhead: number;
    total: number;
  };
  actuals: {
    plant: number;
    labour: number;
    material: number;
    subcontractor: number;
    other: number;
    total: number;
  };
  committed: number;
  forecast: {
    at_completion: number;
    variance: number;
  };
  revenue: {
    original_contract: number;
    approved_variations: number;
    revised_contract: number;
  };
  margin: {
    budget: number;
    budget_percent: number;
    forecast: number;
    forecast_percent: number;
  };
  progress: {
    percent_complete: number;
    earned_value: number;
    cpi: number;
    spi: number;
  };
}

export interface CompanySettings {
  id: string;
  company_name: string;
  default_retention_percent: number;
  default_payment_terms_days: number;
  default_contingency_percent: number;
  default_overhead_percent: number;
  default_margin_percent: number;
  head_office_monthly_cost: number;
  bank_facility_limit: number;
  gst_rate: number;
}

// ============================================================
// MAPPING MODULE TYPES
// ============================================================

export interface ProgrammeTask {
  id: string;
  project_id: string;
  code?: string;
  name: string;
  description?: string;
  parent_id?: string;
  level: number;
  sort_order: number;
  start_date?: string;
  end_date?: string;
  duration_days: number;
  predecessor_id?: string;
  predecessor_lag_days: number;
  percent_complete: number;
  color?: string;
  created_at: string;
  updated_at: string;
  // Calculated fields from API
  wbs_mapping_count?: number;
  resource_mapping_count?: number;
}

export interface ProgrammeWbsMapping {
  id: string;
  project_id: string;
  programme_task_id: string;
  wbs_item_id: string;
  allocation_type: 'percent' | 'fixed_value' | 'quantity_based' | 'duration_based';
  allocation_percent: number;
  allocation_value?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  task_code?: string;
  task_name?: string;
  wbs_code?: string;
  wbs_name?: string;
  wbs_budget?: number;
  start_date?: string;
  end_date?: string;
}

export interface ResourceProgrammeMapping {
  id: string;
  programme_task_id: string;
  resource_type: 'plant' | 'labour' | 'material' | 'subcontractor';
  resource_id: string;
  planned_quantity: number;
  planned_rate: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  task_code?: string;
  task_name?: string;
  resource_code?: string;
  resource_name?: string;
}

export interface AllocationRule {
  id: string;
  project_id?: string;
  name: string;
  description?: string;
  rule_type: 'manual' | 'template' | 'auto';
  source_type?: 'daily_log' | 'cost_entry' | 'plant_hours' | 'labour_hours' | 'material' | 'quantity';
  match_criteria?: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  target_count?: number;
  targets?: AllocationRuleTarget[];
}

export interface AllocationRuleTarget {
  id: string;
  rule_id: string;
  wbs_item_id: string;
  allocation_type: 'percent' | 'fixed_value' | 'remainder';
  allocation_percent?: number;
  allocation_value?: number;
  priority: number;
  wbs_code?: string;
  wbs_name?: string;
}

export interface ActualCostAllocation {
  id: string;
  source_type: 'plant_hours' | 'labour_hours' | 'material' | 'quantity' | 'cost_entry';
  source_id: string;
  wbs_item_id: string;
  programme_task_id?: string;
  allocated_quantity?: number;
  allocated_value?: number;
  allocation_method: 'manual' | 'rule' | 'auto' | 'direct';
  rule_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  wbs_code?: string;
  wbs_name?: string;
  task_code?: string;
  task_name?: string;
}

export interface MappingTemplate {
  id: string;
  project_id?: string;
  name: string;
  description?: string;
  template_type: 'programme_wbs' | 'cost_allocation' | 'resource_schedule';
  template_data: string;
  is_global: boolean;
  created_at: string;
  updated_at: string;
}

export interface MappingValidation {
  summary: {
    total_tasks: number;
    mapped_tasks: number;
    unmapped_tasks: number;
    total_wbs: number;
    mapped_wbs: number;
    unmapped_wbs: number;
    total_mappings: number;
    incomplete_allocations: number;
    coverage_percent: number;
    is_complete: boolean;
  };
  issues: {
    unmapped_tasks: { id: string; code: string; name: string; issue_type: string }[];
    unmapped_wbs: { id: string; code: string; name: string; issue_type: string }[];
    incomplete_allocations: { id: string; code: string; name: string; total_percent: number; issue_type: string }[];
  };
}

export interface MappingMatrix {
  tasks: ProgrammeTask[];
  wbs_items: WBSItem[];
  mappings: ProgrammeWbsMapping[];
  mapping_lookup: { [key: string]: ProgrammeWbsMapping };
}
