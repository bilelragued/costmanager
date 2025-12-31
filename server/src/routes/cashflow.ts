import { Router } from 'express';
import db from '../database';

const router = Router();

interface CashflowMonth {
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

// Helper: Add months to date
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// Helper: Get month key (YYYY-MM)
function getMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

// Helper: Get last day of month
function getLastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

// Project cashflow forecast - Uses Programme Tasks + WBS Mappings
router.get('/project/:projectId', (req, res) => {
  try {
    const projectId = req.params.projectId;
    const months = parseInt(req.query.months as string) || 12;

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const settings = db.prepare('SELECT * FROM company_settings WHERE id = ?').get('default') as any;

    // Check if project uses programme_tasks (new mapping system) or WBS items (legacy)
    const programmeTasks = db.prepare(`
      SELECT * FROM programme_tasks WHERE project_id = ? AND start_date IS NOT NULL
    `).all(projectId) as any[];

    const useMappings = programmeTasks.length > 0;

    // Initialize months
    let startDate = project.start_date ? new Date(project.start_date) : new Date();

    // If using mappings, find earliest programme task start
    if (useMappings && programmeTasks.length > 0) {
      const earliestStart = programmeTasks.reduce((earliest, task) => {
        if (!task.start_date) return earliest;
        const taskStart = new Date(task.start_date);
        return !earliest || taskStart < earliest ? taskStart : earliest;
      }, null as Date | null);
      if (earliestStart) startDate = earliestStart;
    }

    const cashflow: Map<string, CashflowMonth> = new Map();

    for (let i = 0; i < months; i++) {
      const monthDate = addMonths(startDate, i);
      const monthKey = getMonthKey(monthDate);
      cashflow.set(monthKey, {
        month: monthKey,
        inflows: { claims: 0, retentionRelease: 0, total: 0 },
        outflows: { labour: 0, plant: 0, materials: 0, subcontractors: 0, other: 0, total: 0 },
        net: 0,
        cumulative: 0
      });
    }

    if (useMappings) {
      // NEW: Use programme tasks with WBS mappings for cost distribution
      const mappingsWithCosts = db.prepare(`
        SELECT
          pt.id as task_id,
          pt.start_date,
          pt.end_date,
          pt.duration_days,
          pwm.allocation_percent,
          pwm.allocation_type,
          w.id as wbs_id,
          w.quantity,
          w.schedule_of_rates_rate,
          w.is_payment_milestone,
          (SELECT COALESCE(SUM(budgeted_hours * hourly_rate), 0) FROM wbs_plant_assignments WHERE wbs_item_id = w.id) as plant_cost,
          (SELECT COALESCE(SUM(budgeted_hours * hourly_rate * quantity), 0) FROM wbs_labour_assignments WHERE wbs_item_id = w.id) as labour_cost,
          (SELECT COALESCE(SUM(budgeted_quantity * unit_rate), 0) FROM wbs_material_assignments WHERE wbs_item_id = w.id) as material_cost,
          (SELECT COALESCE(SUM(budgeted_value), 0) FROM wbs_subcontractor_assignments WHERE wbs_item_id = w.id) as subcontractor_cost
        FROM programme_tasks pt
        JOIN programme_wbs_mappings pwm ON pt.id = pwm.programme_task_id
        JOIN wbs_items w ON pwm.wbs_item_id = w.id
        WHERE pt.project_id = ? AND pt.start_date IS NOT NULL
        ORDER BY pt.start_date
      `).all(projectId) as any[];

      // Distribute costs based on programme task dates + allocation percentages
      for (const mapping of mappingsWithCosts) {
        if (!mapping.start_date || !mapping.end_date) continue;

        const start = new Date(mapping.start_date);
        const end = new Date(mapping.end_date);
        const durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

        // Apply allocation percentage to costs
        const allocationFactor = (mapping.allocation_percent || 100) / 100;

        // Daily cost rates (allocated portion)
        const dailyLabour = (mapping.labour_cost * allocationFactor) / durationDays;
        const dailyPlant = (mapping.plant_cost * allocationFactor) / durationDays;
        const dailyMaterial = (mapping.material_cost * allocationFactor) / durationDays;
        const dailySubcon = (mapping.subcontractor_cost * allocationFactor) / durationDays;
        const dailyRevenue = mapping.is_payment_milestone
          ? (mapping.quantity * mapping.schedule_of_rates_rate * allocationFactor) / durationDays
          : 0;

        let currentDate = new Date(start);
        while (currentDate <= end) {
          const monthKey = getMonthKey(currentDate);
          const monthData = cashflow.get(monthKey);

          if (monthData) {
            monthData.outflows.labour += dailyLabour;
            monthData.outflows.plant += dailyPlant * 0.5;

            const paymentMonth = getMonthKey(addMonths(currentDate, 1));
            const paymentMonthData = cashflow.get(paymentMonth);
            if (paymentMonthData) {
              paymentMonthData.outflows.plant += dailyPlant * 0.5;
              paymentMonthData.outflows.materials += dailyMaterial;
              paymentMonthData.outflows.subcontractors += dailySubcon;
            }

            if (dailyRevenue > 0) {
              const revenueMonth = getMonthKey(addMonths(currentDate, 1));
              const revenueMonthData = cashflow.get(revenueMonth);
              if (revenueMonthData) {
                revenueMonthData.inflows.claims += dailyRevenue * (1 - project.retention_percent / 100);
              }
            }
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    } else {
      // LEGACY: Use WBS items directly (fallback for projects without mappings)
      const wbsItems = db.prepare(`
        SELECT
          w.*,
          (SELECT COALESCE(SUM(budgeted_hours * hourly_rate), 0) FROM wbs_plant_assignments WHERE wbs_item_id = w.id) as plant_cost,
          (SELECT COALESCE(SUM(budgeted_hours * hourly_rate * quantity), 0) FROM wbs_labour_assignments WHERE wbs_item_id = w.id) as labour_cost,
          (SELECT COALESCE(SUM(budgeted_quantity * unit_rate), 0) FROM wbs_material_assignments WHERE wbs_item_id = w.id) as material_cost,
          (SELECT COALESCE(SUM(budgeted_value), 0) FROM wbs_subcontractor_assignments WHERE wbs_item_id = w.id) as subcontractor_cost
        FROM wbs_items w
        WHERE w.project_id = ? AND w.start_date IS NOT NULL
        ORDER BY w.start_date
      `).all(projectId) as any[];

      for (const wbs of wbsItems) {
        if (!wbs.start_date || !wbs.end_date) continue;

        const start = new Date(wbs.start_date);
        const end = new Date(wbs.end_date);
        const durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

        const dailyLabour = wbs.labour_cost / durationDays;
        const dailyPlant = wbs.plant_cost / durationDays;
        const dailyMaterial = wbs.material_cost / durationDays;
        const dailySubcon = wbs.subcontractor_cost / durationDays;
        const dailyRevenue = wbs.is_payment_milestone ? (wbs.quantity * wbs.schedule_of_rates_rate) / durationDays : 0;

        let currentDate = new Date(start);
        while (currentDate <= end) {
          const monthKey = getMonthKey(currentDate);
          const monthData = cashflow.get(monthKey);

          if (monthData) {
            monthData.outflows.labour += dailyLabour;
            monthData.outflows.plant += dailyPlant * 0.5;

            const paymentMonth = getMonthKey(addMonths(currentDate, 1));
            const paymentMonthData = cashflow.get(paymentMonth);
            if (paymentMonthData) {
              paymentMonthData.outflows.plant += dailyPlant * 0.5;
              paymentMonthData.outflows.materials += dailyMaterial;
              paymentMonthData.outflows.subcontractors += dailySubcon;
            }

            if (dailyRevenue > 0) {
              const revenueMonth = getMonthKey(addMonths(currentDate, 1));
              const revenueMonthData = cashflow.get(revenueMonth);
              if (revenueMonthData) {
                revenueMonthData.inflows.claims += dailyRevenue * (1 - project.retention_percent / 100);
              }
            }
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    }

    // Calculate totals and cumulative
    let cumulative = 0;
    const result: CashflowMonth[] = [];

    cashflow.forEach((month, key) => {
      month.outflows.total = month.outflows.labour + month.outflows.plant +
        month.outflows.materials + month.outflows.subcontractors + month.outflows.other;
      month.inflows.total = month.inflows.claims + month.inflows.retentionRelease;
      month.net = month.inflows.total - month.outflows.total;
      cumulative += month.net;
      month.cumulative = cumulative;
      result.push(month);
    });

    // Sort by month
    result.sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      project_id: projectId,
      project_name: project.name,
      uses_mappings: useMappings,
      forecast: result,
      summary: {
        total_inflows: result.reduce((sum, m) => sum + m.inflows.total, 0),
        total_outflows: result.reduce((sum, m) => sum + m.outflows.total, 0),
        net_cashflow: cumulative,
        peak_negative: Math.min(...result.map(m => m.cumulative)),
        peak_positive: Math.max(...result.map(m => m.cumulative))
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to calculate cashflow' });
  }
});

// Company-wide cashflow
router.get('/company', (req, res) => {
  try {
    const months = parseInt(req.query.months as string) || 12;
    const settings = db.prepare('SELECT * FROM company_settings WHERE id = ?').get('default') as any;

    // Get all active projects
    const projects = db.prepare(`
      SELECT * FROM projects WHERE status = 'active'
    `).all() as any[];

    // Initialize months
    const startDate = new Date();
    startDate.setDate(1); // Start of current month
    const companyCashflow: Map<string, CashflowMonth & { projects: Map<string, number> }> = new Map();

    for (let i = 0; i < months; i++) {
      const monthDate = addMonths(startDate, i);
      const monthKey = getMonthKey(monthDate);
      companyCashflow.set(monthKey, {
        month: monthKey,
        inflows: { claims: 0, retentionRelease: 0, total: 0 },
        outflows: { labour: 0, plant: 0, materials: 0, subcontractors: 0, other: 0, total: 0 },
        net: 0,
        cumulative: 0,
        projects: new Map()
      });
    }

    // Aggregate project cashflows
    for (const project of projects) {
      const wbsItems = db.prepare(`
        SELECT
          w.*,
          (SELECT COALESCE(SUM(budgeted_hours * hourly_rate), 0) FROM wbs_plant_assignments WHERE wbs_item_id = w.id) as plant_cost,
          (SELECT COALESCE(SUM(budgeted_hours * hourly_rate * quantity), 0) FROM wbs_labour_assignments WHERE wbs_item_id = w.id) as labour_cost,
          (SELECT COALESCE(SUM(budgeted_quantity * unit_rate), 0) FROM wbs_material_assignments WHERE wbs_item_id = w.id) as material_cost,
          (SELECT COALESCE(SUM(budgeted_value), 0) FROM wbs_subcontractor_assignments WHERE wbs_item_id = w.id) as subcontractor_cost
        FROM wbs_items w
        WHERE w.project_id = ? AND w.start_date IS NOT NULL
      `).all(project.id) as any[];

      for (const wbs of wbsItems) {
        if (!wbs.start_date || !wbs.end_date) continue;

        const start = new Date(wbs.start_date);
        const end = new Date(wbs.end_date);
        const durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

        const dailyLabour = wbs.labour_cost / durationDays;
        const dailyPlant = wbs.plant_cost / durationDays;
        const dailyMaterial = wbs.material_cost / durationDays;
        const dailySubcon = wbs.subcontractor_cost / durationDays;
        const dailyRevenue = wbs.is_payment_milestone ? (wbs.quantity * wbs.schedule_of_rates_rate) / durationDays : 0;

        let currentDate = new Date(start);
        while (currentDate <= end) {
          const monthKey = getMonthKey(currentDate);
          const monthData = companyCashflow.get(monthKey);

          if (monthData) {
            monthData.outflows.labour += dailyLabour;
            monthData.outflows.plant += dailyPlant * 0.5;

            const paymentMonth = getMonthKey(addMonths(currentDate, 1));
            const paymentMonthData = companyCashflow.get(paymentMonth);
            if (paymentMonthData) {
              paymentMonthData.outflows.plant += dailyPlant * 0.5;
              paymentMonthData.outflows.materials += dailyMaterial;
              paymentMonthData.outflows.subcontractors += dailySubcon;
            }

            if (dailyRevenue > 0) {
              const revenueMonth = getMonthKey(addMonths(currentDate, 1));
              const revenueMonthData = companyCashflow.get(revenueMonth);
              if (revenueMonthData) {
                revenueMonthData.inflows.claims += dailyRevenue * (1 - project.retention_percent / 100);
              }
            }

            // Track per-project contribution
            const projectNet = (dailyRevenue * (1 - project.retention_percent / 100)) -
              dailyLabour - dailyPlant - dailyMaterial - dailySubcon;
            const currentProjectNet = monthData.projects.get(project.id) || 0;
            monthData.projects.set(project.id, currentProjectNet + projectNet);
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    }

    // Add head office costs
    companyCashflow.forEach(month => {
      month.outflows.other += settings.head_office_monthly_cost || 0;
    });

    // Calculate totals and cumulative
    let cumulative = 0;
    const result: any[] = [];

    companyCashflow.forEach((month, key) => {
      month.outflows.total = month.outflows.labour + month.outflows.plant +
        month.outflows.materials + month.outflows.subcontractors + month.outflows.other;
      month.inflows.total = month.inflows.claims + month.inflows.retentionRelease;
      month.net = month.inflows.total - month.outflows.total;
      cumulative += month.net;
      month.cumulative = cumulative;

      // Convert projects map to object
      const projectContributions: Record<string, number> = {};
      month.projects.forEach((value, projectId) => {
        projectContributions[projectId] = value;
      });

      result.push({
        ...month,
        projects: projectContributions
      });
    });

    result.sort((a, b) => a.month.localeCompare(b.month));

    // Get project names for reference
    const projectMap: Record<string, string> = {};
    projects.forEach(p => { projectMap[p.id] = p.name; });

    res.json({
      forecast: result,
      projects: projectMap,
      summary: {
        total_inflows: result.reduce((sum, m) => sum + m.inflows.total, 0),
        total_outflows: result.reduce((sum, m) => sum + m.outflows.total, 0),
        net_cashflow: cumulative,
        peak_negative: Math.min(...result.map(m => m.cumulative)),
        bank_facility: settings.bank_facility_limit || 0
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to calculate company cashflow' });
  }
});

// What-if scenario
router.post('/scenario', (req, res) => {
  try {
    const { base_project_id, adjustments } = req.body;

    // adjustments can include:
    // - delay_weeks: number of weeks to delay project start
    // - cost_increase_percent: percentage increase in costs
    // - payment_delay_days: additional days before payment received

    // Get base project cashflow
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(base_project_id) as any;
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const delayWeeks = adjustments?.delay_weeks || 0;
    const costIncrease = adjustments?.cost_increase_percent || 0;
    const paymentDelay = adjustments?.payment_delay_days || 0;

    // Recalculate with adjustments
    const adjustedStart = new Date(project.start_date || new Date());
    adjustedStart.setDate(adjustedStart.getDate() + (delayWeeks * 7));

    const wbsItems = db.prepare(`
      SELECT
        w.*,
        (SELECT COALESCE(SUM(budgeted_hours * hourly_rate), 0) FROM wbs_plant_assignments WHERE wbs_item_id = w.id) as plant_cost,
        (SELECT COALESCE(SUM(budgeted_hours * hourly_rate * quantity), 0) FROM wbs_labour_assignments WHERE wbs_item_id = w.id) as labour_cost,
        (SELECT COALESCE(SUM(budgeted_quantity * unit_rate), 0) FROM wbs_material_assignments WHERE wbs_item_id = w.id) as material_cost,
        (SELECT COALESCE(SUM(budgeted_value), 0) FROM wbs_subcontractor_assignments WHERE wbs_item_id = w.id) as subcontractor_cost
      FROM wbs_items w
      WHERE w.project_id = ?
    `).all(base_project_id) as any[];

    const cashflow: Map<string, CashflowMonth> = new Map();

    for (let i = 0; i < 12; i++) {
      const monthDate = addMonths(adjustedStart, i);
      const monthKey = getMonthKey(monthDate);
      cashflow.set(monthKey, {
        month: monthKey,
        inflows: { claims: 0, retentionRelease: 0, total: 0 },
        outflows: { labour: 0, plant: 0, materials: 0, subcontractors: 0, other: 0, total: 0 },
        net: 0,
        cumulative: 0
      });
    }

    const costMultiplier = 1 + (costIncrease / 100);
    const paymentDelayMonths = Math.ceil(paymentDelay / 30);

    for (const wbs of wbsItems) {
      if (!wbs.start_date || !wbs.end_date) continue;

      const start = new Date(wbs.start_date);
      start.setDate(start.getDate() + (delayWeeks * 7));
      const end = new Date(wbs.end_date);
      end.setDate(end.getDate() + (delayWeeks * 7));

      const durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

      const dailyLabour = (wbs.labour_cost * costMultiplier) / durationDays;
      const dailyPlant = (wbs.plant_cost * costMultiplier) / durationDays;
      const dailyMaterial = (wbs.material_cost * costMultiplier) / durationDays;
      const dailySubcon = (wbs.subcontractor_cost * costMultiplier) / durationDays;
      const dailyRevenue = wbs.is_payment_milestone ? (wbs.quantity * wbs.schedule_of_rates_rate) / durationDays : 0;

      let currentDate = new Date(start);
      while (currentDate <= end) {
        const monthKey = getMonthKey(currentDate);
        const monthData = cashflow.get(monthKey);

        if (monthData) {
          monthData.outflows.labour += dailyLabour;
          monthData.outflows.plant += dailyPlant * 0.5;

          const paymentMonth = getMonthKey(addMonths(currentDate, 1));
          const paymentMonthData = cashflow.get(paymentMonth);
          if (paymentMonthData) {
            paymentMonthData.outflows.plant += dailyPlant * 0.5;
            paymentMonthData.outflows.materials += dailyMaterial;
            paymentMonthData.outflows.subcontractors += dailySubcon;
          }

          if (dailyRevenue > 0) {
            const revenueMonth = getMonthKey(addMonths(currentDate, 1 + paymentDelayMonths));
            const revenueMonthData = cashflow.get(revenueMonth);
            if (revenueMonthData) {
              revenueMonthData.inflows.claims += dailyRevenue * (1 - project.retention_percent / 100);
            }
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    let cumulative = 0;
    const result: CashflowMonth[] = [];

    cashflow.forEach(month => {
      month.outflows.total = month.outflows.labour + month.outflows.plant +
        month.outflows.materials + month.outflows.subcontractors + month.outflows.other;
      month.inflows.total = month.inflows.claims + month.inflows.retentionRelease;
      month.net = month.inflows.total - month.outflows.total;
      cumulative += month.net;
      month.cumulative = cumulative;
      result.push(month);
    });

    result.sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      scenario: adjustments,
      forecast: result,
      impact: {
        total_cost_increase: wbsItems.reduce((sum, w) =>
          sum + (w.plant_cost + w.labour_cost + w.material_cost + w.subcontractor_cost) * (costIncrease / 100), 0),
        peak_negative: Math.min(...result.map(m => m.cumulative))
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to calculate scenario' });
  }
});

export default router;
