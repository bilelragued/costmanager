import db from '../database';
import { v4 as uuidv4 } from 'uuid';

class LearningEngine {
  // Extract patterns from accepted suggestions
  async buildPatternsForProject(projectId: string): Promise<void> {
    try {
      const acceptedSuggestions = db.prepare(`
        SELECT * FROM cost_assignment_suggestions
        WHERE project_id = ? AND status = 'accepted'
      `).all(projectId);

      for (const sug of acceptedSuggestions as any[]) {
        // Extract keywords from description
        const keywords = this.extractKeywords(sug.transaction_description || '');

        if (keywords.length === 0) continue;

        // Update or create pattern
        const existing = db.prepare(`
          SELECT * FROM assignment_learning_history
          WHERE project_id = ? AND vendor_name = ? AND description_pattern = ?
        `).get(projectId, sug.vendor_name, keywords.join(' '));

        if (existing) {
          db.prepare(`
            UPDATE assignment_learning_history
            SET frequency = frequency + 1, last_used = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run((existing as any).id);
        } else {
          db.prepare(`
            INSERT INTO assignment_learning_history (
              id, project_id, vendor_name, description_pattern, cost_type,
              wbs_item_id, programme_task_id, revenue_item_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            uuidv4(),
            projectId,
            sug.vendor_name,
            keywords.join(' '),
            sug.cost_type,
            sug.accepted_wbs_item_id,
            sug.accepted_programme_task_id,
            sug.accepted_revenue_item_id
          );
        }
      }
    } catch (error) {
      console.error('Error building patterns:', error);
    }
  }

  // Get relevant patterns for a transaction
  async getRelevantPatterns(projectId: string, description: string, vendor: string): Promise<any[]> {
    try {
      const patterns = db.prepare(`
        SELECT alh.*,
          w.code as wbs_code, w.name as wbs_name,
          pt.code as programme_code, pt.name as programme_name,
          ri.code as revenue_code, ri.name as revenue_name
        FROM assignment_learning_history alh
        LEFT JOIN wbs_items w ON alh.wbs_item_id = w.id
        LEFT JOIN programme_tasks pt ON alh.programme_task_id = pt.id
        LEFT JOIN revenue_items ri ON alh.revenue_item_id = ri.id
        WHERE alh.project_id = ?
        ORDER BY alh.frequency DESC, alh.last_used DESC
        LIMIT 10
      `).all(projectId);

      // Fuzzy match on description and vendor
      return (patterns as any[]).filter(p => {
        if (!p.description_pattern && !p.vendor_name) return false;

        const descMatch = description && p.description_pattern
          ? description.toLowerCase().includes(p.description_pattern.toLowerCase())
          : false;

        const vendorMatch = vendor && p.vendor_name
          ? vendor.toLowerCase() === p.vendor_name.toLowerCase()
          : false;

        return descMatch || vendorMatch;
      });
    } catch (error) {
      console.error('Error getting relevant patterns:', error);
      return [];
    }
  }

  // Update vendor patterns
  async updateVendorPattern(vendor: string, projectId: string, assignment: { cost_type?: string; wbs_item_id?: string }): Promise<void> {
    try {
      const existing = db.prepare(`
        SELECT * FROM vendor_patterns WHERE vendor_name = ? AND project_id = ?
      `).get(vendor, projectId);

      if (existing) {
        db.prepare(`
          UPDATE vendor_patterns
          SET transaction_count = transaction_count + 1,
              last_updated = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run((existing as any).id);
      } else {
        db.prepare(`
          INSERT INTO vendor_patterns (
            id, vendor_name, primary_cost_type, project_id, transaction_count
          ) VALUES (?, ?, ?, ?, 1)
        `).run(uuidv4(), vendor, assignment.cost_type || 'unknown', projectId);
      }
    } catch (error) {
      console.error('Error updating vendor pattern:', error);
    }
  }

  // Get vendor pattern
  async getVendorPattern(vendor: string, projectId: string): Promise<any | null> {
    try {
      const pattern = db.prepare(`
        SELECT * FROM vendor_patterns WHERE vendor_name = ? AND project_id = ?
      `).get(vendor, projectId);

      return pattern || null;
    } catch (error) {
      console.error('Error getting vendor pattern:', error);
      return null;
    }
  }

  // Extract keywords from description
  private extractKeywords(description: string): string[] {
    if (!description) return [];

    return description
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 3) // Only words longer than 3 characters
      .filter(word => !this.isStopWord(word)) // Remove common stop words
      .slice(0, 5); // Limit to 5 keywords
  }

  // Common stop words to ignore
  private isStopWord(word: string): boolean {
    const stopWords = [
      'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'been', 'were',
      'will', 'would', 'could', 'should', 'their', 'there', 'here', 'when', 'where'
    ];
    return stopWords.includes(word);
  }

  // Clear old patterns (optional maintenance function)
  async clearOldPatterns(projectId: string, daysOld: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      db.prepare(`
        DELETE FROM assignment_learning_history
        WHERE project_id = ? AND last_used < ? AND frequency < 2
      `).run(projectId, cutoffDate.toISOString());
    } catch (error) {
      console.error('Error clearing old patterns:', error);
    }
  }
}

export const learningEngine = new LearningEngine();
