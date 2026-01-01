import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError, ZodIssue } from 'zod';

// Validation middleware factory
export function validate<T extends ZodSchema>(schema: T, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      req[source] = data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.issues.map((e: ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      } else {
        next(error);
      }
    }
  };
}

// Common field schemas
const uuid = z.string().uuid();
const optionalUuid = z.string().uuid().optional().nullable();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();
const positiveNumber = z.number().min(0);
const percent = z.number().min(0).max(100);

// Project schemas
export const projectSchemas = {
  create: z.object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(200),
    client: z.string().max(200).optional().nullable(),
    status: z.enum(['tender', 'active', 'completed', 'cancelled']).optional(),
    start_date: dateString,
    end_date: dateString,
    contract_value: positiveNumber.optional(),
    retention_percent: percent.optional(),
    payment_terms_days: z.number().int().min(0).max(365).optional(),
    contingency_percent: percent.optional(),
    overhead_percent: percent.optional(),
    margin_percent: percent.optional(),
  }),
  update: z.object({
    code: z.string().min(1).max(50).optional(),
    name: z.string().min(1).max(200).optional(),
    client: z.string().max(200).optional().nullable(),
    status: z.enum(['tender', 'active', 'completed', 'cancelled']).optional(),
    start_date: dateString,
    end_date: dateString,
    contract_value: positiveNumber.optional(),
    retention_percent: percent.optional(),
    payment_terms_days: z.number().int().min(0).max(365).optional(),
    contingency_percent: percent.optional(),
    overhead_percent: percent.optional(),
    margin_percent: percent.optional(),
  }),
  clone: z.object({
    code: z.string().min(1).max(50).optional(),
    name: z.string().min(1).max(200).optional(),
  }),
};

// WBS schemas
export const wbsSchemas = {
  create: z.object({
    project_id: uuid,
    parent_id: optionalUuid,
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional().nullable(),
    level: z.number().int().min(1).max(10).optional(),
    sort_order: z.number().int().min(0).optional(),
    quantity: positiveNumber.optional(),
    unit: z.string().max(20).optional().nullable(),
    budgeted_unit_rate: positiveNumber.optional(),
    start_date: dateString,
    end_date: dateString,
    duration_days: z.number().int().min(0).optional(),
    is_payment_milestone: z.union([z.boolean(), z.number()]).optional(),
    payment_percent: percent.optional(),
    schedule_of_rates_rate: positiveNumber.optional(),
  }),
  update: z.object({
    code: z.string().min(1).max(50).optional(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional().nullable(),
    quantity: positiveNumber.optional(),
    unit: z.string().max(20).optional().nullable(),
    budgeted_unit_rate: positiveNumber.optional(),
    start_date: dateString,
    end_date: dateString,
    duration_days: z.number().int().min(0).optional(),
    is_payment_milestone: z.union([z.boolean(), z.number()]).optional(),
    payment_percent: percent.optional(),
    schedule_of_rates_rate: positiveNumber.optional(),
  }),
};

// Resource schemas
export const resourceSchemas = {
  plant: {
    create: z.object({
      code: z.string().min(1).max(50),
      description: z.string().min(1).max(200),
      ownership_type: z.enum(['owned', 'hired']).optional(),
      hourly_rate: positiveNumber,
      hire_rate: positiveNumber.optional(),
      requires_operator: z.union([z.boolean(), z.number()]).optional(),
      mobilisation_cost: positiveNumber.optional(),
    }),
  },
  labour: {
    create: z.object({
      code: z.string().min(1).max(50),
      role: z.string().min(1).max(100),
      hourly_rate: positiveNumber,
      overtime_rate_1_5: positiveNumber.optional(),
      overtime_rate_2: positiveNumber.optional(),
    }),
  },
  material: {
    create: z.object({
      code: z.string().min(1).max(50),
      description: z.string().min(1).max(200),
      unit: z.string().min(1).max(20),
      base_rate: positiveNumber,
      lead_time_days: z.number().int().min(0).optional(),
    }),
  },
  subcontractor: {
    create: z.object({
      code: z.string().min(1).max(50),
      trade: z.string().min(1).max(100),
      rate_type: z.enum(['lump_sum', 'measure_value', 'hourly']).optional(),
      default_rate: positiveNumber.optional(),
      retention_percent: percent.optional(),
      payment_terms_days: z.number().int().min(0).max(365).optional(),
    }),
  },
};

// Cost entry schemas
export const costSchemas = {
  entry: z.object({
    project_id: uuid,
    wbs_item_id: optionalUuid,
    cost_type: z.enum(['plant', 'labour', 'material', 'subcontractor', 'other']),
    description: z.string().max(500).optional().nullable(),
    invoice_number: z.string().max(100).optional().nullable(),
    invoice_date: dateString,
    amount: z.number(),
    payment_due_date: dateString,
    status: z.enum(['pending', 'approved', 'paid']).optional(),
    vendor_name: z.string().max(200).optional().nullable(),
    programme_task_id: optionalUuid,
    revenue_item_id: optionalUuid,
  }),
  variation: z.object({
    project_id: uuid,
    variation_number: z.number().int().min(1).optional(),
    description: z.string().min(1).max(1000),
    status: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
    claimed_value: z.number().optional(),
    approved_value: z.number().optional(),
    cost_impact: z.number().optional(),
    notes: z.string().max(2000).optional().nullable(),
  }),
};

// Claim schemas
export const claimSchemas = {
  create: z.object({
    project_id: uuid,
    claim_period_start: z.string().min(1),
    claim_period_end: z.string().min(1),
    notes: z.string().max(2000).optional().nullable(),
  }),
  update: z.object({
    submitted_date: dateString,
    certified_date: dateString,
    paid_date: dateString,
    certified_amount: positiveNumber.optional(),
    status: z.enum(['draft', 'submitted', 'certified', 'paid']).optional(),
    notes: z.string().max(2000).optional().nullable(),
  }),
};

// Programme task schemas
export const programmeTaskSchemas = {
  create: z.object({
    project_id: uuid,
    code: z.string().max(50).optional().nullable(),
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional().nullable(),
    parent_id: optionalUuid,
    level: z.number().int().min(1).max(10).optional(),
    sort_order: z.number().int().min(0).optional(),
    start_date: dateString,
    end_date: dateString,
    duration_days: z.number().int().min(0).optional(),
    predecessor_id: optionalUuid,
    predecessor_lag_days: z.number().int().optional(),
    percent_complete: percent.optional(),
    color: z.string().max(20).optional().nullable(),
  }),
  update: z.object({
    code: z.string().max(50).optional().nullable(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional().nullable(),
    start_date: dateString,
    end_date: dateString,
    duration_days: z.number().int().min(0).optional(),
    predecessor_id: optionalUuid,
    predecessor_lag_days: z.number().int().optional(),
    percent_complete: percent.optional(),
    color: z.string().max(20).optional().nullable(),
  }),
};

// Mapping schemas
export const mappingSchemas = {
  programmeWbs: z.object({
    project_id: uuid,
    programme_task_id: uuid,
    wbs_item_id: uuid,
    allocation_type: z.enum(['percent', 'fixed_value', 'quantity_based', 'duration_based']).optional(),
    allocation_percent: percent.optional(),
    allocation_value: positiveNumber.optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  }),
  resourceProgramme: z.object({
    programme_task_id: uuid,
    resource_type: z.enum(['plant', 'labour', 'material', 'subcontractor']),
    resource_id: uuid,
    planned_quantity: positiveNumber.optional(),
    planned_rate: positiveNumber.optional(),
    notes: z.string().max(500).optional().nullable(),
  }),
  allocationRule: z.object({
    project_id: optionalUuid,
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional().nullable(),
    rule_type: z.enum(['manual', 'template', 'auto']).optional(),
    source_type: z.enum(['daily_log', 'cost_entry', 'plant_hours', 'labour_hours', 'material', 'quantity']).optional().nullable(),
    match_criteria: z.string().max(1000).optional().nullable(),
    is_active: z.union([z.boolean(), z.number()]).optional(),
    priority: z.number().int().min(0).optional(),
  }),
};

// Revenue schemas
export const revenueSchemas = {
  create: z.object({
    project_id: uuid,
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional().nullable(),
    parent_id: optionalUuid,
    level: z.number().int().min(1).max(10).optional(),
    sort_order: z.number().int().min(0).optional(),
    unit: z.string().max(20).optional().nullable(),
    contract_quantity: positiveNumber.optional(),
    contract_rate: positiveNumber.optional(),
    contract_value: positiveNumber.optional(),
    payment_milestone: z.union([z.boolean(), z.number()]).optional(),
    payment_percent: percent.optional(),
    notes: z.string().max(1000).optional().nullable(),
  }),
};

// AI schemas
export const aiSchemas = {
  suggestAssignment: z.object({
    project_id: uuid,
    description: z.string().min(1).max(1000),
    vendor_name: z.string().max(200).optional().nullable(),
    amount: z.number(),
    transaction_date: z.string().min(1),
    cost_type: z.enum(['plant', 'labour', 'material', 'subcontractor', 'other']).optional(),
  }),
};

// ID param schema
export const idParamSchema = z.object({
  id: uuid,
});

export const projectIdParamSchema = z.object({
  projectId: uuid,
});
