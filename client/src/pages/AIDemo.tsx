import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { debounce } from 'lodash';
import { aiApi } from '../services/api';
import AISuggestionCard from '../components/AISuggestionCard';
import { Sparkles, Info } from 'lucide-react';

export default function AIDemo() {
  const { id: projectId } = useParams<{ id: string }>();
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [costType, setCostType] = useState('material');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<{enabled: boolean; message: string} | null>(null);

  // Check AI status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await aiApi.getStatus();
        setAiStatus(status);
      } catch (error) {
        console.error('Failed to check AI status:', error);
      }
    };
    checkStatus();
  }, []);

  // Debounced AI suggestion fetch
  const debouncedGetSuggestions = useMemo(
    () =>
      debounce(async (desc: string, vend: string, amt: number, type: string) => {
        if (desc.length < 5) {
          setSuggestions([]);
          return;
        }

        setLoading(true);
        try {
          const result = await aiApi.suggestAssignment({
            project_id: projectId!,
            description: desc,
            vendor_name: vend,
            amount: amt,
            transaction_date: new Date().toISOString(),
            cost_type: type,
          });

          setSuggestions(result.suggestions || []);
        } catch (error) {
          console.error('AI suggestion error:', error);
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      }, 800),
    [projectId]
  );

  useEffect(() => {
    if (description) {
      debouncedGetSuggestions(description, vendor, amount, costType);
    } else {
      setSuggestions([]);
    }
  }, [description, vendor, amount, costType, debouncedGetSuggestions]);

  const handleAcceptSuggestion = async (suggestion: any) => {
    if (!suggestion.id) return;

    try {
      await aiApi.acceptSuggestion(suggestion.id);
      alert(`Accepted suggestion:\nWBS: ${suggestion.wbs_item_code}\nProgramme: ${suggestion.programme_task_code || 'N/A'}\nRevenue: ${suggestion.revenue_item_code || 'N/A'}`);

      // Clear form
      setDescription('');
      setVendor('');
      setAmount(0);
      setSuggestions([]);
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
      alert('Failed to accept suggestion');
    }
  };

  const handleRejectSuggestion = async (suggestion: any) => {
    if (!suggestion.id) return;

    try {
      await aiApi.rejectSuggestion(suggestion.id, 'User rejected');
      setSuggestions(suggestions.filter(s => s.id !== suggestion.id));
    } catch (error) {
      console.error('Failed to reject suggestion:', error);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">AI Cost Assignment Demo</h1>
        </div>
        <p className="text-gray-600">
          Enter transaction details and watch AI suggest WBS, Programme, and Revenue assignments in real-time.
        </p>
      </div>

      {/* AI Status Banner */}
      {aiStatus && (
        <div className={`mb-6 p-4 rounded-lg border ${aiStatus.enabled ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-start gap-2">
            <Info className={`w-5 h-5 mt-0.5 ${aiStatus.enabled ? 'text-green-600' : 'text-yellow-600'}`} />
            <div>
              <p className={`font-medium ${aiStatus.enabled ? 'text-green-900' : 'text-yellow-900'}`}>
                {aiStatus.message}
              </p>
              {!aiStatus.enabled && (
                <p className="text-sm text-yellow-700 mt-1">
                  Set <code className="bg-yellow-100 px-1 rounded">ANTHROPIC_API_KEY</code> in server/.env to enable AI features.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transaction Input Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction Details</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="E.g., Bulk earthworks invoice for site clearing"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Type at least 5 characters to trigger AI suggestions
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor
              </label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="E.g., ABC Earthmoving Ltd"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (NZD)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cost Type
            </label>
            <select
              value={costType}
              onChange={(e) => setCostType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="plant">Plant</option>
              <option value="labour">Labour</option>
              <option value="material">Material</option>
              <option value="subcontractor">Subcontractor</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* AI Suggestions */}
      <AISuggestionCard
        suggestions={suggestions}
        loading={loading}
        onAccept={handleAcceptSuggestion}
        onReject={handleRejectSuggestion}
      />

      {/* Help Text */}
      {!loading && suggestions.length === 0 && description.length >= 5 && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-600">
            No suggestions yet. Make sure you have:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-1">
            <li>Created WBS items for this project</li>
            <li>Created Programme tasks</li>
            <li>Created Revenue items (optional)</li>
            <li>AI is enabled (check status banner above)</li>
          </ul>
        </div>
      )}
    </div>
  );
}
