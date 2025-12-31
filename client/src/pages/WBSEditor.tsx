import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { wbsApi, projectsApi } from '../services/api';
import { formatCurrency, formatNumber } from '../utils/format';
import {
  ArrowLeft,
  Plus,
  ChevronRight,
  ChevronDown,
  Trash2,
  Edit2,
  X
} from 'lucide-react';

export default function WBSEditor() {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
  });

  const { data: wbsItems = [], isLoading } = useQuery({
    queryKey: ['wbs', projectId],
    queryFn: () => wbsApi.listByProject(projectId!),
  });

  const createMutation = useMutation({
    mutationFn: wbsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wbs', projectId] });
      setShowAddForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: wbsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wbs', projectId] });
    },
  });

  const [newItem, setNewItem] = useState({
    code: '',
    name: '',
    description: '',
    level: 1,
    quantity: 0,
    unit: '',
    duration_days: 0,
    is_payment_milestone: false,
    schedule_of_rates_rate: 0,
  });

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...newItem,
      project_id: projectId,
      sort_order: wbsItems.length,
    });
  };

  // Calculate totals
  const totalDirectCost = wbsItems.reduce((sum: number, item: any) => sum + (item.total_cost || 0), 0);
  const totalContractValue = wbsItems
    .filter((item: any) => item.is_payment_milestone)
    .reduce((sum: number, item: any) => sum + (item.quantity * item.schedule_of_rates_rate), 0);

  const contingency = totalDirectCost * ((project?.contingency_percent || 5) / 100);
  const overhead = totalDirectCost * ((project?.overhead_percent || 8) / 100);
  const totalCost = totalDirectCost + contingency + overhead;
  const margin = totalContractValue - totalCost;
  const marginPercent = totalContractValue > 0 ? (margin / totalContractValue) * 100 : 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Work Breakdown Structure</h1>
            <p className="text-gray-500">{project?.name}</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add WBS Item
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Direct Cost</p>
          <p className="text-xl font-bold">{formatCurrency(totalDirectCost)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">+ Contingency ({project?.contingency_percent}%)</p>
          <p className="text-xl font-bold">{formatCurrency(contingency)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">+ Overhead ({project?.overhead_percent}%)</p>
          <p className="text-xl font-bold">{formatCurrency(overhead)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Contract Value</p>
          <p className="text-xl font-bold">{formatCurrency(totalContractValue)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Margin</p>
          <p className={`text-xl font-bold ${marginPercent >= 5 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(margin)} ({marginPercent.toFixed(1)}%)
          </p>
        </div>
      </div>

      {/* WBS Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-3 w-12"></th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3 text-right">Direct Cost</th>
              <th className="px-4 py-3 text-right">Unit Rate</th>
              <th className="px-4 py-3 text-right">SoR Rate</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3 text-right">Duration</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                  Loading WBS items...
                </td>
              </tr>
            ) : wbsItems.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                  No WBS items. Click "Add WBS Item" to create one.
                </td>
              </tr>
            ) : (
              wbsItems.map((item: any) => (
                <tr
                  key={item.id}
                  className={`hover:bg-gray-50 ${selectedItem === item.id ? 'bg-primary-50' : ''}`}
                  onClick={() => setSelectedItem(item.id)}
                >
                  <td className="px-4 py-3">
                    {item.level === 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(item.id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {expandedItems.has(item.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm" style={{ paddingLeft: `${item.level * 16}px` }}>
                    {item.code}
                  </td>
                  <td className="px-4 py-3">
                    <span className={item.level === 1 ? 'font-semibold' : ''}>
                      {item.name}
                    </span>
                    {item.is_payment_milestone && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        Milestone
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {item.quantity > 0 ? formatNumber(item.quantity, 2) : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{item.unit || '-'}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {item.total_cost > 0 ? formatCurrency(item.total_cost) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500">
                    {item.unit_rate_calculated > 0 ? `$${formatNumber(item.unit_rate_calculated, 2)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {item.schedule_of_rates_rate > 0 ? `$${formatNumber(item.schedule_of_rates_rate, 2)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    {item.is_payment_milestone && item.quantity > 0
                      ? formatCurrency(item.quantity * item.schedule_of_rates_rate)
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {item.duration_days > 0 ? `${item.duration_days}d` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItem(item.id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this WBS item?')) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        className="p-1 hover:bg-red-100 rounded text-gray-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add WBS Item</h2>
              <button onClick={() => setShowAddForm(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Code</label>
                  <input
                    type="text"
                    value={newItem.code}
                    onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
                    className="input"
                    placeholder="e.g., 1.0 or 2.1"
                    required
                  />
                </div>
                <div>
                  <label className="label">Level</label>
                  <select
                    value={newItem.level}
                    onChange={(e) => setNewItem({ ...newItem, level: parseInt(e.target.value) })}
                    className="input"
                  >
                    <option value={1}>Level 1 (Main)</option>
                    <option value={2}>Level 2 (Sub)</option>
                    <option value={3}>Level 3 (Detail)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="input"
                  placeholder="e.g., Bulk Earthworks"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Quantity</label>
                  <input
                    type="number"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                    className="input"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <input
                    type="text"
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                    className="input"
                    placeholder="m3, m2, LS"
                  />
                </div>
                <div>
                  <label className="label">Duration (days)</label>
                  <input
                    type="number"
                    value={newItem.duration_days}
                    onChange={(e) => setNewItem({ ...newItem, duration_days: parseInt(e.target.value) || 0 })}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Schedule of Rates Rate ($/unit)</label>
                  <input
                    type="number"
                    value={newItem.schedule_of_rates_rate}
                    onChange={(e) => setNewItem({ ...newItem, schedule_of_rates_rate: parseFloat(e.target.value) || 0 })}
                    className="input"
                    step="0.01"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newItem.is_payment_milestone}
                      onChange={(e) => setNewItem({ ...newItem, is_payment_milestone: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Payment Milestone</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
