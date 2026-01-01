import { Router } from 'express';
import { claudeAI } from '../services/claude-ai';
import { learningEngine } from '../services/learning-engine';
import db from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================================
// AI COST ASSIGNMENT SUGGESTIONS
// ============================================================

// Real-time suggestion during cost entry
router.post('/suggest-assignment', async (req, res) => {
  try {
    const { project_id, description, vendor_name, amount, transaction_date, cost_type } = req.body;

    if (!claudeAI.isEnabled()) {
      return res.json({ suggestions: [], message: 'AI suggestions are disabled. Set ANTHROPIC_API_KEY to enable.' });
    }

    // Gather context
    const available_wbs = db.prepare('SELECT id, code, name, total_cost as budget FROM wbs_items WHERE project_id = ?').all(project_id) as any[];
    const available_programme = db.prepare('SELECT id, code, name, start_date, end_date FROM programme_tasks WHERE project_id = ?').all(project_id) as any[];
    const available_revenue = db.prepare('SELECT id, code, name, contract_rate, unit FROM revenue_items WHERE project_id = ?').all(project_id) as any[];

    const historical_patterns = await learningEngine.getRelevantPatterns(project_id, description, vendor_name);

    const vendor_pattern = vendor_name
      ? await learningEngine.getVendorPattern(vendor_name, project_id)
      : null;

    const existing_mappings = {
      programme_wbs: db.prepare('SELECT * FROM programme_wbs_mappings WHERE project_id = ?').all(project_id) as any[],
      programme_revenue: db.prepare('SELECT * FROM programme_revenue_mappings WHERE project_id = ?').all(project_id) as any[],
      wbs_revenue: db.prepare('SELECT * FROM wbs_revenue_mappings WHERE project_id = ?').all(project_id) as any[],
    };

    // Call Claude AI
    const suggestions = await claudeAI.suggestAssignment({
      project_id,
      transaction: { description, vendor_name, amount, date: transaction_date, cost_type },
      available_wbs,
      available_programme,
      available_revenue,
      historical_patterns,
      vendor_pattern,
      existing_mappings,
    });

    // Store suggestions in database
    const storedSuggestions = [];
    for (const sug of suggestions) {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO cost_assignment_suggestions (
          id, project_id, source_type, source_id, transaction_description, vendor_name,
          transaction_date, amount, suggested_wbs_item_id, suggested_programme_task_id,
          suggested_revenue_item_id, confidence_score, reasoning
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, project_id, 'cost_entry', 'temp', description, vendor_name,
        transaction_date, amount, sug.wbs_item_id, sug.programme_task_id,
        sug.revenue_item_id, sug.confidence, sug.reasoning
      );

      storedSuggestions.push({ ...sug, id });
    }

    res.json({ suggestions: storedSuggestions });
  } catch (error) {
    console.error('AI suggestion error:', error);
    res.status(500).json({ error: 'Failed to generate suggestions', details: (error as Error).message });
  }
});

// Accept suggestion
router.post('/suggestion/:suggestionId/accept', async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const { modifications } = req.body;

    const suggestion = db.prepare('SELECT * FROM cost_assignment_suggestions WHERE id = ?').get(suggestionId) as any;

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    const accepted_wbs = modifications?.wbs_item_id || suggestion.suggested_wbs_item_id;
    const accepted_programme = modifications?.programme_task_id || suggestion.suggested_programme_task_id;
    const accepted_revenue = modifications?.revenue_item_id || suggestion.suggested_revenue_item_id;

    db.prepare(`
      UPDATE cost_assignment_suggestions
      SET status = ?, accepted_wbs_item_id = ?, accepted_programme_task_id = ?, accepted_revenue_item_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run('accepted', accepted_wbs, accepted_programme, accepted_revenue, suggestionId);

    // Update learning patterns
    await learningEngine.buildPatternsForProject(suggestion.project_id);

    if (suggestion.vendor_name) {
      await learningEngine.updateVendorPattern(
        suggestion.vendor_name,
        suggestion.project_id,
        { cost_type: suggestion.cost_type, wbs_item_id: accepted_wbs }
      );
    }

    res.json({ success: true, assignments: { accepted_wbs, accepted_programme, accepted_revenue } });
  } catch (error) {
    console.error('Accept suggestion error:', error);
    res.status(500).json({ error: 'Failed to accept suggestion' });
  }
});

// Reject suggestion
router.post('/suggestion/:suggestionId/reject', async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const { reason } = req.body;

    db.prepare(`
      UPDATE cost_assignment_suggestions
      SET status = ?, user_feedback = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run('rejected', reason || null, suggestionId);

    res.json({ success: true });
  } catch (error) {
    console.error('Reject suggestion error:', error);
    res.status(500).json({ error: 'Failed to reject suggestion' });
  }
});

// Batch assign unassigned costs
router.post('/batch-assign/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { source_type = 'cost_entries', source_ids } = req.body;

    if (!claudeAI.isEnabled()) {
      return res.json({ processed: 0, suggestions: [], message: 'AI suggestions are disabled' });
    }

    // Get unassigned cost entries
    let unassigned: any[];
    if (source_ids && source_ids.length > 0) {
      const placeholders = source_ids.map(() => '?').join(',');
      unassigned = db.prepare(`
        SELECT * FROM cost_entries
        WHERE id IN (${placeholders}) AND project_id = ?
      `).all(...source_ids, projectId) as any[];
    } else {
      unassigned = db.prepare(`
        SELECT * FROM cost_entries
        WHERE wbs_item_id IS NULL AND project_id = ?
      `).all(projectId) as any[];
    }

    const suggestions = [];

    // Gather context once (same for all entries)
    const available_wbs = db.prepare('SELECT id, code, name, total_cost as budget FROM wbs_items WHERE project_id = ?').all(projectId) as any[];
    const available_programme = db.prepare('SELECT id, code, name, start_date, end_date FROM programme_tasks WHERE project_id = ?').all(projectId) as any[];
    const available_revenue = db.prepare('SELECT id, code, name, contract_rate, unit FROM revenue_items WHERE project_id = ?').all(projectId) as any[];
    const existing_mappings = {
      programme_wbs: db.prepare('SELECT * FROM programme_wbs_mappings WHERE project_id = ?').all(projectId) as any[],
      programme_revenue: db.prepare('SELECT * FROM programme_revenue_mappings WHERE project_id = ?').all(projectId) as any[],
      wbs_revenue: db.prepare('SELECT * FROM wbs_revenue_mappings WHERE project_id = ?').all(projectId) as any[],
    };

    for (const entry of unassigned) {
      const historical_patterns = await learningEngine.getRelevantPatterns(projectId, entry.description, entry.vendor_name);
      const vendor_pattern = entry.vendor_name
        ? await learningEngine.getVendorPattern(entry.vendor_name, projectId)
        : null;

      const entrySuggestions = await claudeAI.suggestAssignment({
        project_id: projectId,
        transaction: {
          description: entry.description,
          vendor_name: entry.vendor_name,
          amount: entry.amount,
          date: entry.invoice_date || new Date().toISOString(),
          cost_type: entry.cost_type
        },
        available_wbs,
        available_programme,
        available_revenue,
        historical_patterns,
        vendor_pattern,
        existing_mappings,
      });

      // Store suggestions
      for (const sug of entrySuggestions) {
        const id = uuidv4();
        db.prepare(`
          INSERT INTO cost_assignment_suggestions (
            id, project_id, source_type, source_id, transaction_description, vendor_name,
            transaction_date, amount, suggested_wbs_item_id, suggested_programme_task_id,
            suggested_revenue_item_id, confidence_score, reasoning
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, projectId, 'cost_entry', entry.id, entry.description, entry.vendor_name,
          entry.invoice_date, entry.amount, sug.wbs_item_id, sug.programme_task_id,
          sug.revenue_item_id, sug.confidence, sug.reasoning
        );

        suggestions.push({ ...sug, id, source_id: entry.id });
      }
    }

    res.json({ processed: unassigned.length, suggestions });
  } catch (error) {
    console.error('Batch assign error:', error);
    res.status(500).json({ error: 'Failed to batch assign' });
  }
});

// Get pending suggestions
router.get('/suggestions/:projectId', (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const suggestions = db.prepare(`
      SELECT cas.*,
        w.code as wbs_code, w.name as wbs_name,
        pt.code as programme_code, pt.name as programme_name,
        ri.code as revenue_code, ri.name as revenue_name
      FROM cost_assignment_suggestions cas
      LEFT JOIN wbs_items w ON cas.suggested_wbs_item_id = w.id
      LEFT JOIN programme_tasks pt ON cas.suggested_programme_task_id = pt.id
      LEFT JOIN revenue_items ri ON cas.suggested_revenue_item_id = ri.id
      WHERE cas.project_id = ? AND cas.status = ?
      ORDER BY cas.created_at DESC
    `).all(req.params.projectId, status);

    res.json(suggestions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// Get vendor patterns for a project
router.get('/vendor-patterns/:projectId', (req, res) => {
  try {
    const patterns = db.prepare(`
      SELECT * FROM vendor_patterns
      WHERE project_id = ?
      ORDER BY transaction_count DESC, last_updated DESC
    `).all(req.params.projectId);

    res.json(patterns);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch vendor patterns' });
  }
});

// Train/rebuild patterns from historical data
router.post('/train/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    await learningEngine.buildPatternsForProject(projectId);

    const patterns = db.prepare(`
      SELECT COUNT(*) as count FROM assignment_learning_history WHERE project_id = ?
    `).get(projectId) as any;

    res.json({ success: true, patterns_created: patterns.count });
  } catch (error) {
    console.error('Train error:', error);
    res.status(500).json({ error: 'Failed to train patterns' });
  }
});

// Get AI status
router.get('/status', (req, res) => {
  res.json({
    enabled: claudeAI.isEnabled(),
    message: claudeAI.isEnabled()
      ? 'AI suggestions are active'
      : 'AI disabled: Set ANTHROPIC_API_KEY environment variable to enable'
  });
});

export default router;
