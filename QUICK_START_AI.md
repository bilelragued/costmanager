# Quick Start Guide: AI Cost Assignment

## 🚀 Get Started in 5 Minutes

### Step 1: Get Your Anthropic API Key
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-ant-api03-`)

### Step 2: Configure Environment
```bash
# Navigate to server directory
cd server

# Create .env file from example
cp .env.example .env

# Edit .env and add your API key
# On Windows:
notepad .env

# Add this line:
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
```

### Step 3: Install Dependencies (if not already done)
```bash
# Server dependencies
cd server
npm install

# Client dependencies
cd ../client
npm install
```

### Step 4: Start the Application
```bash
# From root directory
npm run dev

# Or start individually:
npm run dev:server  # Terminal 1
npm run dev:client  # Terminal 2
```

### Step 5: Access AI Demo
1. Open browser to http://localhost:3000
2. Create or select a project
3. Add some WBS items (cost breakdown)
4. Add some Programme tasks (schedule)
5. (Optional) Add Revenue items or import from WBS
6. Navigate to: http://localhost:3000/projects/{project-id}/ai-demo

**Note**: You'll need to add the AI Demo route to your router first (see below).

## 📝 Add AI Demo to Router (One-Time Setup)

Edit `client/src/App.tsx`:

```typescript
import AIDemo from './pages/AIDemo';

// In your Routes:
<Route path="/projects/:id/ai-demo" element={<AIDemo />} />
```

## 🎯 Test AI Suggestions

### Example Transaction 1: Earthworks
```
Description: "Bulk earthworks for site clearing and leveling"
Vendor: "ABC Earthmoving Ltd"
Amount: 45000
Cost Type: Subcontractor
```

Expected: AI should suggest WBS item related to earthworks, programme task for site prep, and revenue item for earthworks (if exists).

### Example Transaction 2: Concrete
```
Description: "Ready mix concrete delivery for foundation slabs"
Vendor: "Concrete Solutions NZ"
Amount: 12500
Cost Type: Material
```

Expected: AI should match to concrete-related WBS item and foundation programme task.

### Example Transaction 3: Plant Hire
```
Description: "20-tonne excavator hire for 2 weeks"
Vendor: "Equipment Rentals Ltd"
Amount: 8400
Cost Type: Plant
```

Expected: AI should suggest plant-related WBS and current active programme task.

## 🔍 Verify AI is Working

### Check AI Status
Open browser console and run:
```javascript
fetch('http://localhost:3001/api/ai/status')
  .then(r => r.json())
  .then(console.log);

// Should return: { enabled: true, message: "AI suggestions are active" }
```

### Check Database Tables
Run this in your database viewer or server console:
```sql
-- Check revenue items table exists
SELECT * FROM revenue_items LIMIT 1;

-- Check AI suggestions table exists
SELECT * FROM cost_assignment_suggestions LIMIT 1;

-- Check learning history table exists
SELECT * FROM assignment_learning_history LIMIT 1;
```

## 💡 Tips for Best Results

### 1. Use Descriptive Transaction Descriptions
❌ Bad: "Invoice #123"
✅ Good: "Earthworks invoice for bulk cut and fill operations in zone A"

### 2. Include Vendor Names
- AI learns vendor patterns over time
- "ABC Earthmoving" → automatically categorized as earthworks/plant
- "Concrete Solutions" → automatically categorized as materials

### 3. Build Historical Patterns
- Accept initial suggestions
- System learns from your corrections
- After 10-20 accepted suggestions, accuracy improves significantly

### 4. Use Consistent Naming
- Keep WBS codes consistent (e.g., "2.1 Earthworks" not "Earthworks 2.1")
- Use standard construction terminology
- AI recognizes NZ/AU construction terms

## 📊 Monitor AI Performance

### View Suggestions History
```bash
# In browser console:
fetch('http://localhost:3001/api/ai/suggestions/{projectId}?status=accepted')
  .then(r => r.json())
  .then(console.log);
```

### View Vendor Patterns
```bash
fetch('http://localhost:3001/api/ai/vendor-patterns/{projectId}')
  .then(r => r.json())
  .then(console.log);
```

### Rebuild Learning Patterns
```bash
fetch('http://localhost:3001/api/ai/train/{projectId}', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);
```

## 🐛 Troubleshooting

### Problem: "AI suggestions are disabled"
**Solution**:
1. Check `.env` file has `ANTHROPIC_API_KEY=sk-ant-...`
2. Restart server: `npm run dev:server`
3. Verify API key is valid at https://console.anthropic.com/

### Problem: No suggestions appearing
**Checklist**:
- [ ] Project has WBS items created
- [ ] Project has Programme tasks created
- [ ] Transaction description is at least 5 characters
- [ ] Server console shows no errors
- [ ] Browser console shows no errors
- [ ] AI status endpoint returns `enabled: true`

### Problem: Low confidence scores
**Solutions**:
- Create more specific WBS item names
- Add more programme tasks with relevant names
- Use more descriptive transaction descriptions
- Accept more suggestions to build learning patterns

### Problem: API costs too high
**Solutions**:
- Set `AI_BATCH_SIZE=20` in .env (default 50)
- Set `AI_CONFIDENCE_THRESHOLD=80` (only show high confidence)
- Use learning patterns (reduces API calls)
- Cache common transactions

## 💰 Cost Estimation

### Claude API Pricing (as of 2026)
- Input: $3 per 1M tokens
- Output: $15 per 1M tokens

### Typical Usage
- Average suggestion: ~2,000 input tokens, ~200 output tokens
- Cost per suggestion: ~$0.01
- 100 suggestions/month: ~$1.00
- 1,000 suggestions/month: ~$10.00

### Cost Optimization
- Learning patterns reduce API calls by ~60% after training
- Batch processing is more efficient than real-time
- Set higher confidence thresholds to reduce suggestions

## 🎓 Advanced Usage

### Batch Process Unassigned Costs
```typescript
// Process all unassigned cost entries
const result = await aiApi.batchAssign(projectId);
console.log(`Processed ${result.processed} costs`);
console.log(`Generated ${result.suggestions.length} suggestions`);
```

### Custom Confidence Threshold
```typescript
// Only show high-confidence suggestions
const suggestions = response.suggestions.filter(s => s.confidence >= 80);
```

### Multi-Assignment (Split Costs)
```typescript
// Accept suggestion with modifications
await aiApi.acceptSuggestion(suggestionId, {
  // Override AI's suggestion
  wbs_item_id: customWbsId,
  programme_task_id: customTaskId
});
```

## 📚 Next Steps

1. ✅ Set up API key and test basic suggestions
2. ✅ Create comprehensive WBS structure
3. ✅ Build out programme schedule
4. ✅ Import or create revenue items
5. ✅ Process 20-30 transactions to build patterns
6. ✅ Monitor accuracy and adjust confidence thresholds
7. ✅ Integrate into main cost entry workflows
8. ✅ Train team on accepting/rejecting suggestions

## 🆘 Support

### Check Logs
```bash
# Server logs (in terminal running dev:server)
# Look for:
# - "Claude AI service disabled" (API key issue)
# - "AI suggestion error" (API call failed)
# - "Failed to parse AI response" (prompt issue)
```

### Test API Directly
```bash
# Test suggestion endpoint
curl -X POST http://localhost:3001/api/ai/suggest-assignment \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "your-project-id",
    "description": "Test earthworks invoice",
    "vendor_name": "Test Vendor",
    "amount": 1000,
    "transaction_date": "2026-01-01",
    "cost_type": "subcontractor"
  }'
```

## ✨ Enjoy AI-Powered Cost Assignment!

Your system is now intelligent and will get smarter over time as you use it.

For detailed implementation docs, see [AI_IMPLEMENTATION_SUMMARY.md](./AI_IMPLEMENTATION_SUMMARY.md)
