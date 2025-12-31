import { Router } from 'express';
import db from '../database';

const router = Router();

// Project dashboard
router.get('/project/:projectId', (req, res) => {
  try {
    const projectId = req.params.projectId;

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Programme status
    const programmeStatus = db.prepare(`
      SELECT
        COUNT(*) as total_items,
        SUM(CASE WHEN end_date < date('now') THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN start_date <= date('now') AND end_date >= date('now') THEN 1 ELSE 0 END) as in_progress,
        MIN(start_date) as earliest_start,
        MAX(end_date) as latest_end
      FROM wbs_items
      WHERE project_id = ? AND duration_days > 0
    `).get(projectId) as any;

    // Calculate programme percent complete (simplified)
    const totalDuration = programmeStatus.earliest_start && programmeStatus.latest_end
      ? Math.ceil((new Date(programmeStatus.latest_end).getTime() - new Date(programmeStatus.earliest_start).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const elapsed = programmeStatus.earliest_start
      ? Math.ceil((new Date().getTime() - new Date(programmeStatus.earliest_start).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const programmePercent = totalDuration > 0 ? Math.min(100, Math.max(0, (elapsed / totalDuration) * 100)) : 0;

    // Cost status
    const budget = db.prepare(`
      SELECT COALESCE(SUM(
        (SELECT COALESCE(SUM(budgeted_hours * hourly_rate), 0) FROM wbs_plant_assignments WHERE wbs_item_id = w.id) +
        (SELECT COALESCE(SUM(budgeted_hours * hourly_rate * quantity), 0) FROM wbs_labour_assignments WHERE wbs_item_id = w.id) +
        (SELECT COALESCE(SUM(budgeted_quantity * unit_rate), 0) FROM wbs_material_assignments WHERE wbs_item_id = w.id) +
        (SELECT COALESCE(SUM(budgeted_value), 0) FROM wbs_subcontractor_assignments WHERE wbs_item_id = w.id)
      ), 0) as total
      FROM wbs_items w
      WHERE w.project_id = ?
    `).get(projectId) as any;

    const actuals = db.prepare(`
      SELECT
        COALESCE((SELECT SUM(aph.hours * pt.hourly_rate) FROM actual_plant_hours aph
          JOIN daily_logs dl ON aph.daily_log_id = dl.id
          JOIN plant_types pt ON aph.plant_type_id = pt.id
          WHERE dl.project_id = ?), 0) +
        COALESCE((SELECT SUM(alh.hours * alh.workers * lt.hourly_rate) FROM actual_labour_hours alh
          JOIN daily_logs dl ON alh.daily_log_id = dl.id
          JOIN labour_types lt ON alh.labour_type_id = lt.id
          WHERE dl.project_id = ?), 0) +
        COALESCE((SELECT SUM(am.quantity * am.unit_cost) FROM actual_materials am
          JOIN daily_logs dl ON am.daily_log_id = dl.id
          WHERE dl.project_id = ?), 0) +
        COALESCE((SELECT SUM(amount) FROM cost_entries WHERE project_id = ?), 0) as total
    `).get(projectId, projectId, projectId, projectId) as any;

    // Progress
    const progress = db.prepare(`
      SELECT
        COALESCE(SUM(w.quantity), 0) as total_qty,
        COALESCE(SUM(COALESCE(aq.completed, 0)), 0) as completed_qty
      FROM wbs_items w
      LEFT JOIN (
        SELECT wbs_item_id, SUM(quantity_completed) as completed
        FROM actual_quantities
        GROUP BY wbs_item_id
      ) aq ON w.id = aq.wbs_item_id
      WHERE w.project_id = ? AND w.quantity > 0
    `).get(projectId) as any;

    const progressPercent = progress.total_qty > 0 ? (progress.completed_qty / progress.total_qty) * 100 : 0;

    // Earned value
    const earnedValue = budget.total * (progressPercent / 100);
    const cpi = actuals.total > 0 ? earnedValue / actuals.total : 1;
    const forecastAtCompletion = cpi > 0 ? budget.total / cpi : budget.total;

    // Revenue status
    const revenue = db.prepare(`
      SELECT
        COALESCE(SUM(quantity * schedule_of_rates_rate), 0) as contract_value
      FROM wbs_items
      WHERE project_id = ? AND is_payment_milestone = 1
    `).get(projectId) as any;

    const variations = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'approved' THEN approved_value ELSE 0 END), 0) as approved
      FROM variations
      WHERE project_id = ?
    `).get(projectId) as any;

    const claims = db.prepare(`
      SELECT
        COALESCE(SUM(this_claim), 0) as claimed,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN certified_amount ELSE 0 END), 0) as received,
        COALESCE(SUM(CASE WHEN status IN ('submitted', 'certified') THEN this_claim ELSE 0 END), 0) as outstanding
      FROM progress_claims
      WHERE project_id = ? AND status != 'draft'
    `).get(projectId) as any;

    // Margin
    const contractValue = (revenue.contract_value || 0) + (variations.approved || 0);
    const marginBudget = contractValue - budget.total;
    const marginForecast = contractValue - forecastAtCompletion;

    // Alerts
    const alerts: Array<{ type: string; severity: string; message: string }> = [];

    if (cpi < 0.95) {
      alerts.push({
        type: 'cost',
        severity: cpi < 0.9 ? 'high' : 'medium',
        message: `Cost Performance Index is ${cpi.toFixed(2)} - costs are trending ${((1 - cpi) * 100).toFixed(0)}% over budget`
      });
    }

    if (progressPercent < programmePercent - 10) {
      alerts.push({
        type: 'programme',
        severity: 'medium',
        message: `Progress (${progressPercent.toFixed(0)}%) is behind programme (${programmePercent.toFixed(0)}%)`
      });
    }

    if (claims.outstanding > contractValue * 0.1) {
      alerts.push({
        type: 'cashflow',
        severity: 'medium',
        message: `Outstanding claims of $${claims.outstanding.toLocaleString()} exceed 10% of contract value`
      });
    }

    if (marginForecast < contractValue * 0.03) {
      alerts.push({
        type: 'margin',
        severity: 'high',
        message: `Forecast margin of ${((marginForecast / contractValue) * 100).toFixed(1)}% is below 3% threshold`
      });
    }

    res.json({
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
        status: project.status
      },
      programme: {
        percent_complete: programmePercent,
        start_date: programmeStatus.earliest_start,
        end_date: programmeStatus.latest_end,
        items_completed: programmeStatus.completed,
        items_in_progress: programmeStatus.in_progress,
        items_total: programmeStatus.total_items
      },
      cost: {
        budget: budget.total,
        actuals: actuals.total,
        forecast: forecastAtCompletion,
        variance: budget.total - forecastAtCompletion,
        variance_percent: budget.total > 0 ? ((budget.total - forecastAtCompletion) / budget.total) * 100 : 0
      },
      progress: {
        percent_complete: progressPercent,
        earned_value: earnedValue,
        cpi,
        spi: progressPercent > 0 && programmePercent > 0 ? progressPercent / programmePercent : 1
      },
      revenue: {
        contract_value: revenue.contract_value,
        variations: variations.approved,
        revised_contract: contractValue,
        claimed: claims.claimed,
        received: claims.received,
        outstanding: claims.outstanding
      },
      margin: {
        budget: marginBudget,
        budget_percent: contractValue > 0 ? (marginBudget / contractValue) * 100 : 0,
        forecast: marginForecast,
        forecast_percent: contractValue > 0 ? (marginForecast / contractValue) * 100 : 0
      },
      alerts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get project dashboard' });
  }
});

// Company dashboard
router.get('/company', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM company_settings WHERE id = ?').get('default') as any;

    // Project counts
    const projectCounts = db.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM projects
      GROUP BY status
    `).all() as any[];

    const counts = {
      tenders: 0,
      active: 0,
      completed: 0
    };
    projectCounts.forEach(p => {
      if (p.status === 'tender') counts.tenders = p.count;
      if (p.status === 'active') counts.active = p.count;
      if (p.status === 'completed') counts.completed = p.count;
    });

    // Active projects summary
    const activeProjects = db.prepare(`
      SELECT
        p.*,
        COALESCE((SELECT SUM(quantity * schedule_of_rates_rate) FROM wbs_items WHERE project_id = p.id AND is_payment_milestone = 1), 0) as contract_value,
        COALESCE((SELECT SUM(
          (SELECT COALESCE(SUM(budgeted_hours * hourly_rate), 0) FROM wbs_plant_assignments WHERE wbs_item_id = w.id) +
          (SELECT COALESCE(SUM(budgeted_hours * hourly_rate * quantity), 0) FROM wbs_labour_assignments WHERE wbs_item_id = w.id) +
          (SELECT COALESCE(SUM(budgeted_quantity * unit_rate), 0) FROM wbs_material_assignments WHERE wbs_item_id = w.id) +
          (SELECT COALESCE(SUM(budgeted_value), 0) FROM wbs_subcontractor_assignments WHERE wbs_item_id = w.id)
        ) FROM wbs_items w WHERE w.project_id = p.id), 0) as budget
      FROM projects p
      WHERE p.status = 'active'
    `).all() as any[];

    // Calculate totals
    const totalContractValue = activeProjects.reduce((sum, p) => sum + p.contract_value, 0);
    const totalBudget = activeProjects.reduce((sum, p) => sum + p.budget, 0);

    // Tender pipeline
    const tenderPipeline = db.prepare(`
      SELECT
        p.*,
        COALESCE((SELECT SUM(quantity * schedule_of_rates_rate) FROM wbs_items WHERE project_id = p.id AND is_payment_milestone = 1), 0) as tender_value
      FROM projects p
      WHERE p.status = 'tender'
      ORDER BY p.created_at DESC
    `).all() as any[];

    const totalTenderValue = tenderPipeline.reduce((sum: number, p: any) => sum + p.tender_value, 0);

    // Outstanding claims
    const outstandingClaims = db.prepare(`
      SELECT
        pc.*,
        p.code as project_code,
        p.name as project_name
      FROM progress_claims pc
      JOIN projects p ON pc.project_id = p.id
      WHERE pc.status IN ('submitted', 'certified')
      ORDER BY pc.submitted_date
    `).all() as any[];

    const totalOutstanding = outstandingClaims.reduce((sum: number, c: any) => sum + c.this_claim, 0);

    // Projects needing attention (simplified - would normally check more conditions)
    const projectsAttention: Array<{ project_id: string; project_code: string; project_name: string; issue: string; severity: string }> = [];

    for (const project of activeProjects) {
      // Check for cost overruns (simplified)
      const actuals = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM cost_entries WHERE project_id = ?
      `).get(project.id) as any;

      if (actuals.total > project.budget * 0.9 && project.budget > 0) {
        projectsAttention.push({
          project_id: project.id,
          project_code: project.code,
          project_name: project.name,
          issue: 'Cost approaching budget',
          severity: actuals.total > project.budget ? 'high' : 'medium'
        });
      }
    }

    res.json({
      summary: {
        active_projects: counts.active,
        active_contract_value: totalContractValue,
        tenders_in_progress: counts.tenders,
        tender_pipeline_value: totalTenderValue,
        outstanding_claims: totalOutstanding,
        bank_facility: settings.bank_facility_limit
      },
      active_projects: activeProjects.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        contract_value: p.contract_value,
        budget: p.budget,
        margin_percent: p.contract_value > 0 ? ((p.contract_value - p.budget) / p.contract_value) * 100 : 0
      })),
      tender_pipeline: tenderPipeline.map((p: any) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        client: p.client,
        tender_value: p.tender_value
      })),
      outstanding_claims: outstandingClaims.map((c: any) => ({
        project_code: c.project_code,
        project_name: c.project_name,
        claim_number: c.claim_number,
        amount: c.this_claim,
        status: c.status,
        submitted_date: c.submitted_date,
        days_outstanding: c.submitted_date
          ? Math.ceil((new Date().getTime() - new Date(c.submitted_date).getTime()) / (1000 * 60 * 60 * 24))
          : 0
      })),
      attention_required: projectsAttention
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get company dashboard' });
  }
});

export default router;
