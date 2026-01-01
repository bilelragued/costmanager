import Anthropic from '@anthropic-ai/sdk';

interface AssignmentContext {
  project_id: string;
  transaction: {
    description: string;
    vendor_name?: string;
    amount: number;
    date: string;
    cost_type?: string;
  };
  available_wbs: Array<{ id: string; code: string; name: string; budget: number }>;
  available_programme: Array<{ id: string; code: string; name: string; start_date: string; end_date: string }>;
  available_revenue: Array<{ id: string; code: string; name: string; contract_rate: number; unit: string }>;
  historical_patterns: Array<{ description_pattern: string; wbs_code: string; programme_code: string }>;
  vendor_pattern?: { vendor_name: string; primary_cost_type: string };
  existing_mappings: {
    programme_wbs: any[];
    programme_revenue: any[];
    wbs_revenue: any[];
  };
}

interface Suggestion {
  wbs_item_id: string;
  wbs_item_code: string;
  wbs_item_name: string;
  programme_task_id?: string;
  programme_task_code?: string;
  programme_task_name?: string;
  revenue_item_id?: string;
  revenue_item_code?: string;
  revenue_item_name?: string;
  confidence: number;
  reasoning: string;
  split_allocation?: Array<{
    wbs_item_id: string;
    programme_task_id?: string;
    revenue_item_id?: string;
    percent: number;
  }>;
}

class ClaudeAIService {
  private client: Anthropic | null = null;
  private model = 'claude-3-5-sonnet-20241022';
  private enabled: boolean;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.enabled = !!apiKey && process.env.AI_ENABLED !== 'false';

    if (this.enabled && apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      console.warn('Claude AI service disabled: ANTHROPIC_API_KEY not set or AI_ENABLED=false');
    }
  }

  async suggestAssignment(context: AssignmentContext): Promise<Suggestion[]> {
    if (!this.enabled || !this.client) {
      console.warn('AI suggestions disabled');
      return [];
    }

    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(context);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4096'),
        temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.3'),
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return this.parseResponse(content.text, context);
      }

      return [];
    } catch (error) {
      console.error('Claude AI error:', error);
      return [];
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert construction cost accountant for a New Zealand/Australian infrastructure ERP system.

Your task is to analyze cost transactions and suggest the best assignment to:
1. WBS Item (cost breakdown structure)
2. Programme Task (schedule/timeline task)
3. Revenue Item (contract pay item from Schedule of Prices)

Consider:
- Transaction description and vendor name
- Historical assignment patterns for similar transactions
- Existing mappings between WBS, Programme, and Revenue
- Date context (match to programme timeline)
- Cost type inference from vendor/description
- NZ/AU construction terminology and practices

Output format: JSON array of 1-3 suggestions ranked by confidence (0-100). Each suggestion must explain reasoning.

Example output:
{
  "suggestions": [
    {
      "wbs_item_code": "2.1",
      "programme_task_code": "PT-2.0",
      "revenue_item_code": "REV-2",
      "confidence": 85,
      "reasoning": "Description mentions 'bulk earthworks' matching WBS 2.1 and Programme PT-2.0. Date aligns with task timeline. Vendor typically supplies earthmoving equipment."
    }
  ]
}

IMPORTANT: Output ONLY valid JSON. Do not include any explanatory text before or after the JSON.`;
  }

  private buildUserPrompt(context: AssignmentContext): string {
    const { transaction, available_wbs, available_programme, available_revenue, historical_patterns, vendor_pattern } = context;

    const wbsSection = available_wbs.length > 0
      ? available_wbs.slice(0, 50).map(w => `- ${w.code}: ${w.name} (Budget: $${w.budget})`).join('\n')
      : 'No WBS items available';

    const programmeSection = available_programme.length > 0
      ? available_programme.slice(0, 50).map(p => `- ${p.code}: ${p.name} (${p.start_date} to ${p.end_date})`).join('\n')
      : 'No programme tasks available';

    const revenueSection = available_revenue.length > 0
      ? available_revenue.slice(0, 50).map(r => `- ${r.code}: ${r.name} (Rate: $${r.contract_rate}/${r.unit})`).join('\n')
      : 'No revenue items available';

    const patternsSection = historical_patterns.length > 0
      ? historical_patterns.slice(0, 10).map(p => `- "${p.description_pattern}" → WBS: ${p.wbs_code}, Programme: ${p.programme_code || 'N/A'}`).join('\n')
      : 'No historical patterns available';

    const vendorSection = vendor_pattern
      ? `This vendor "${vendor_pattern.vendor_name}" typically supplies: ${vendor_pattern.primary_cost_type || 'Unknown'}`
      : 'No vendor history';

    return `Analyze this transaction and suggest assignments:

TRANSACTION:
- Description: "${transaction.description}"
- Vendor: "${transaction.vendor_name || 'N/A'}"
- Amount: $${transaction.amount}
- Date: ${transaction.date}
- Cost Type: ${transaction.cost_type || 'Unknown'}

AVAILABLE WBS ITEMS:
${wbsSection}

AVAILABLE PROGRAMME TASKS:
${programmeSection}

AVAILABLE REVENUE ITEMS:
${revenueSection}

HISTORICAL PATTERNS:
${patternsSection}

VENDOR PATTERNS:
${vendorSection}

Provide 1-3 suggestions ranked by confidence. Output valid JSON only, no additional text.`;
  }

  private parseResponse(responseText: string, context: AssignmentContext): Suggestion[] {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in Claude response');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
        console.error('Invalid suggestions format from Claude');
        return [];
      }

      // Map codes to IDs
      return parsed.suggestions.map((sug: any) => {
        const wbs = context.available_wbs.find(w => w.code === sug.wbs_item_code);
        const prog = sug.programme_task_code
          ? context.available_programme.find(p => p.code === sug.programme_task_code)
          : null;
        const rev = sug.revenue_item_code
          ? context.available_revenue.find(r => r.code === sug.revenue_item_code)
          : null;

        if (!wbs) {
          console.warn(`WBS code ${sug.wbs_item_code} not found`);
        }

        return {
          wbs_item_id: wbs?.id || '',
          wbs_item_code: sug.wbs_item_code || '',
          wbs_item_name: wbs?.name || '',
          programme_task_id: prog?.id,
          programme_task_code: sug.programme_task_code,
          programme_task_name: prog?.name,
          revenue_item_id: rev?.id,
          revenue_item_code: sug.revenue_item_code,
          revenue_item_name: rev?.name,
          confidence: sug.confidence || 0,
          reasoning: sug.reasoning || 'No reasoning provided',
          split_allocation: sug.split_allocation,
        };
      }).filter((s: Suggestion) => s.wbs_item_id); // Filter out invalid suggestions
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.error('Response text:', responseText);
      return [];
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const claudeAI = new ClaudeAIService();
