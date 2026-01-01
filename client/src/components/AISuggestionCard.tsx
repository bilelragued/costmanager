import { CheckCircle2, XCircle, Sparkles } from 'lucide-react';

interface Suggestion {
  id?: string;
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
}

interface AISuggestionCardProps {
  suggestions: Suggestion[];
  loading: boolean;
  onAccept: (suggestion: Suggestion) => void;
  onReject?: (suggestion: Suggestion) => void;
}

export default function AISuggestionCard({ suggestions, loading, onAccept, onReject }: AISuggestionCardProps) {
  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-700">
          <Sparkles className="w-5 h-5 animate-pulse" />
          <span className="font-medium">AI analyzing transaction...</span>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-700 border-green-300';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    return 'bg-orange-100 text-orange-700 border-orange-300';
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-blue-900">
        <Sparkles className="w-5 h-5" />
        <h4 className="font-semibold">AI Suggestions</h4>
      </div>

      {suggestions.map((sug, idx) => (
        <div
          key={idx}
          className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">WBS:</span>
                <span className="text-sm font-medium text-gray-900">
                  {sug.wbs_item_code} - {sug.wbs_item_name}
                </span>
              </div>

              {sug.programme_task_code && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">Programme:</span>
                  <span className="text-sm text-gray-700">
                    {sug.programme_task_code} - {sug.programme_task_name}
                  </span>
                </div>
              )}

              {sug.revenue_item_code && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">Revenue:</span>
                  <span className="text-sm text-gray-700">
                    {sug.revenue_item_code} - {sug.revenue_item_name}
                  </span>
                </div>
              )}
            </div>

            <div
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${getConfidenceBadgeColor(
                sug.confidence
              )}`}
            >
              {sug.confidence}% confidence
            </div>
          </div>

          <div className="mb-3">
            <p className="text-sm text-gray-600 italic">{sug.reasoning}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onAccept(sug)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Accept
            </button>

            {onReject && (
              <button
                onClick={() => onReject(sug)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
