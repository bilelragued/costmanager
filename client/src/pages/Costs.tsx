import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { costsApi, projectsApi } from '../services/api';
import { formatCurrency, formatPercent, formatDate, getStatusColor, getVarianceColor } from '../utils/format';
import { ArrowLeft, Plus, DollarSign, TrendingUp, AlertTriangle, FileText } from 'lucide-react';

export default function Costs() {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'summary' | 'breakdown' | 'variations' | 'entries'>('summary');
  const [showAddVariation, setShowAddVariation] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['costs', 'summary', projectId],
    queryFn: () => costsApi.summary(projectId!),
  });

  const { data: breakdown = [] } = useQuery({
    queryKey: ['costs', 'breakdown', projectId],
    queryFn: () => costsApi.wbsBreakdown(projectId!),
    enabled: activeTab === 'breakdown',
  });

  const { data: variations = [] } = useQuery({
    queryKey: ['costs', 'variations', projectId],
    queryFn: () => costsApi.variations.list(projectId!),
    enabled: activeTab === 'variations',
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['costs', 'entries', projectId],
    queryFn: () => costsApi.entries.list(projectId!),
    enabled: activeTab === 'entries',
  });

  const createVariationMutation = useMutation({
    mutationFn: costsApi.variations.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costs', 'variations', projectId] });
      setShowAddVariation(false);
    },
  });

  const [newVariation, setNewVariation] = useState({
    description: '',
    claimed_value: 0,
    cost_impact: 0,
    notes: '',
  });

  const handleCreateVariation = (e: React.FormEvent) => {
    e.preventDefault();
    createVariationMutation.mutate({
      ...newVariation,
      project_id: projectId,
    });
  };

  const tabs = [
    { id: 'summary', label: 'Summary', icon: DollarSign },
    { id: 'breakdown', label: 'Cost Breakdown', icon: FileText },
    { id: 'variations', label: 'Variations', icon: TrendingUp },
    { id: 'entries', label: 'Cost Entries', icon: AlertTriangle },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cost Management</h1>
          <p className="text-gray-500">{project?.name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {summaryLoading ? (
            <div className="text-center text-gray-500 py-8">Loading cost summary...</div>
          ) : summary ? (
            <>
              {/* Overview Cards */}
              <div className="grid grid-cols-4 gap-6">
                <div className="card p-6">
                  <h3 className="text-sm text-gray-500 mb-2">Budget</h3>
                  <p className="text-2xl font-bold">{formatCurrency(summary.budget.total)}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Direct: {formatCurrency(summary.budget.direct_cost)}
                  </p>
                </div>
                <div className="card p-6">
                  <h3 className="text-sm text-gray-500 mb-2">Actuals to Date</h3>
                  <p className="text-2xl font-bold">{formatCurrency(summary.actuals.total)}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Committed: {formatCurrency(summary.committed)}
                  </p>
                </div>
                <div className="card p-6">
                  <h3 className="text-sm text-gray-500 mb-2">Forecast at Completion</h3>
                  <p className="text-2xl font-bold">{formatCurrency(summary.forecast.at_completion)}</p>
                  <p className={`text-sm mt-1 ${getVarianceColor(summary.forecast.variance)}`}>
                    Variance: {formatCurrency(summary.forecast.variance)}
                  </p>
                </div>
                <div className="card p-6">
                  <h3 className="text-sm text-gray-500 mb-2">Forecast Margin</h3>
                  <p className={`text-2xl font-bold ${summary.margin.forecast_percent < 3 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatPercent(summary.margin.forecast_percent)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatCurrency(summary.margin.forecast)}
                  </p>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="card p-6">
                <h3 className="font-medium mb-4">Cost Breakdown</h3>
                <div className="grid grid-cols-5 gap-6">
                  <div>
                    <p className="text-sm text-gray-500">Plant</p>
                    <p className="text-xl font-bold">{formatCurrency(summary.actuals.plant)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Labour</p>
                    <p className="text-xl font-bold">{formatCurrency(summary.actuals.labour)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Materials</p>
                    <p className="text-xl font-bold">{formatCurrency(summary.actuals.material)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Subcontractors</p>
                    <p className="text-xl font-bold">{formatCurrency(summary.actuals.subcontractor)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Other</p>
                    <p className="text-xl font-bold">{formatCurrency(summary.actuals.other)}</p>
                  </div>
                </div>
              </div>

              {/* Earned Value */}
              <div className="card p-6">
                <h3 className="font-medium mb-4">Earned Value Analysis</h3>
                <div className="grid grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-gray-500">% Complete</p>
                    <p className="text-2xl font-bold">{formatPercent(summary.progress.percent_complete)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Earned Value</p>
                    <p className="text-2xl font-bold">{formatCurrency(summary.progress.earned_value)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">CPI</p>
                    <p className={`text-2xl font-bold ${summary.progress.cpi < 1 ? 'text-red-600' : 'text-green-600'}`}>
                      {summary.progress.cpi.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">SPI</p>
                    <p className={`text-2xl font-bold ${summary.progress.spi < 1 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {summary.progress.spi.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 py-8">No cost data available</div>
          )}
        </div>
      )}

      {/* Cost Breakdown Tab */}
      {activeTab === 'breakdown' && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3">Cost Item</th>
                <th className="px-4 py-3 text-right">Budget</th>
                <th className="px-4 py-3 text-right">Actuals</th>
                <th className="px-4 py-3 text-right">Variance</th>
                <th className="px-4 py-3 text-right">% Complete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {breakdown.map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-gray-500">{item.code}</span>
                    <span className="ml-2">{item.name}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(item.budget_total)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(item.actual_total)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${getVarianceColor(item.variance)}`}>
                    {formatCurrency(item.variance)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatPercent(item.percent_complete)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Variations Tab */}
      {activeTab === 'variations' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowAddVariation(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Variation
            </button>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3">Var #</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Claimed</th>
                  <th className="px-4 py-3 text-right">Approved</th>
                  <th className="px-4 py-3 text-right">Cost Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {variations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No variations recorded
                    </td>
                  </tr>
                ) : (
                  variations.map((v: any) => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">V{String(v.variation_number).padStart(3, '0')}</td>
                      <td className="px-4 py-3">{v.description}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(v.status)}`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(v.claimed_value)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(v.approved_value)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500">{formatCurrency(v.cost_impact)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Add Variation Modal */}
          {showAddVariation && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="card w-full max-w-md">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold">Add Variation</h2>
                </div>
                <form onSubmit={handleCreateVariation} className="p-4 space-y-4">
                  <div>
                    <label className="label">Description</label>
                    <textarea
                      value={newVariation.description}
                      onChange={(e) => setNewVariation({ ...newVariation, description: e.target.value })}
                      className="input"
                      rows={3}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Claimed Value ($)</label>
                      <input
                        type="number"
                        value={newVariation.claimed_value}
                        onChange={(e) => setNewVariation({ ...newVariation, claimed_value: parseFloat(e.target.value) || 0 })}
                        className="input"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="label">Cost Impact ($)</label>
                      <input
                        type="number"
                        value={newVariation.cost_impact}
                        onChange={(e) => setNewVariation({ ...newVariation, cost_impact: parseFloat(e.target.value) || 0 })}
                        className="input"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setShowAddVariation(false)} className="btn btn-secondary flex-1">
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary flex-1">
                      Add Variation
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cost Entries Tab */}
      {activeTab === 'entries' && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No cost entries recorded
                  </td>
                </tr>
              ) : (
                entries.map((entry: any) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{formatDate(entry.invoice_date)}</td>
                    <td className="px-4 py-3 capitalize">{entry.cost_type}</td>
                    <td className="px-4 py-3">{entry.description}</td>
                    <td className="px-4 py-3">{entry.invoice_number || '-'}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(entry.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(entry.status)}`}>
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
