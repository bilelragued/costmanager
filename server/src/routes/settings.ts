import { Router } from 'express';
import db from '../database';
import { seedDatabase } from '../seed';

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
    seedDatabase();
    res.json({
      success: true,
      message: 'Database seeded successfully with 30 realistic projects',
      data: {
        tenders: 20,
        active_projects: 10,
        message: '10 active projects at varying completion stages with full WBS, actuals, and claims'
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to seed demo data' });
  }
});

export default router;
