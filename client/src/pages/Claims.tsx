import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { claimsApi, projectsApi } from '../services/api';
import { formatCurrency, formatDate, getStatusColor } from '../utils/format';
import { ArrowLeft, Plus, FileText, CheckCircle, Clock, DollarSign } from 'lucide-react';

export default function Claims() {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const [showCreateClaim, setShowCreateClaim] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
  });

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['claims', projectId],
    queryFn: () => claimsApi.list(projectId!),
  });

  const { data: summary } = useQuery({
    queryKey: ['claims', 'summary', projectId],
    queryFn: () => claimsApi.summary(projectId!),
  });

  const { data: claimDetail } = useQuery({
    queryKey: ['claim', selectedClaim],
    queryFn: () => claimsApi.get(selectedClaim!),
    enabled: !!selectedClaim,
  });

  const createClaimMutation = useMutation({
    mutationFn: claimsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['claims', projectId] });
      setSelectedClaim(data.id);
      setShowCreateClaim(false);
    },
  });

  const updateClaimMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => claimsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims', projectId] });
      queryClient.invalidateQueries({ queryKey: ['claim', selectedClaim] });
    },
  });

  const [newClaimPeriod, setNewClaimPeriod] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
  });

  const handleCreateClaim = (e: React.FormEvent) => {
    e.preventDefault();
    createClaimMutation.mutate({
      project_id: projectId,
      claim_period_start: newClaimPeriod.start,
      claim_period_end: newClaimPeriod.end,
    });
  };

  const handleSubmitClaim = () => {
    if (selectedClaim) {
      updateClaimMutation.mutate({
        id: selectedClaim,
        data: {
          status: 'submitted',
          submitted_date: new Date().toISOString().split('T')[0],
        },
      });
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Progress Claims</h1>
            <p className="text-gray-500">{project?.name}</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateClaim(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Claim
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="card p-4">
            <p className="text-sm text-gray-500">Contract Value</p>
            <p className="text-xl font-bold">{formatCurrency(summary.revised_contract)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Total Claimed</p>
            <p className="text-xl font-bold">{formatCurrency(summary.claimed)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Received</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(summary.certified)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Outstanding</p>
            <p className="text-xl font-bold text-yellow-600">{formatCurrency(summary.outstanding)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Remaining to Claim</p>
            <p className="text-xl font-bold">{formatCurrency(summary.remaining_to_claim)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Claims List */}
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold">Claims History</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading claims...</div>
            ) : claims.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No claims yet</div>
            ) : (
              claims.map((claim: any) => (
                <button
                  key={claim.id}
                  onClick={() => setSelectedClaim(claim.id)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                    selectedClaim === claim.id ? 'bg-primary-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Claim #{claim.claim_number}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(claim.status)}`}>
                      {claim.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {formatDate(claim.claim_period_start)} - {formatDate(claim.claim_period_end)}
                  </div>
                  <div className="font-medium mt-1">{formatCurrency(claim.this_claim)}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Claim Detail */}
        <div className="col-span-2">
          {selectedClaim && claimDetail ? (
            <div className="card">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Claim #{claimDetail.claim_number}</h2>
                  <p className="text-sm text-gray-500">
                    Period: {formatDate(claimDetail.claim_period_start)} - {formatDate(claimDetail.claim_period_end)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(claimDetail.status)}`}>
                    {claimDetail.status}
                  </span>
                  {claimDetail.status === 'draft' && (
                    <button onClick={handleSubmitClaim} className="btn btn-primary btn-sm">
                      Submit Claim
                    </button>
                  )}
                </div>
              </div>

              {/* Claim Summary */}
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Gross This Claim</p>
                    <p className="font-bold text-lg">{formatCurrency(claimDetail.gross_amount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Less Retention ({project?.retention_percent}%)</p>
                    <p className="font-bold text-lg text-red-600">-{formatCurrency(claimDetail.retention_held)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Net Claim</p>
                    <p className="font-bold text-lg">{formatCurrency(claimDetail.this_claim)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Invoice (incl GST)</p>
                    <p className="font-bold text-lg text-primary-600">{formatCurrency(claimDetail.total_invoice)}</p>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-header text-xs">
                      <th className="px-4 py-2">Item</th>
                      <th className="px-4 py-2 text-right">Contract Qty</th>
                      <th className="px-4 py-2 text-right">Previous</th>
                      <th className="px-4 py-2 text-right">This Period</th>
                      <th className="px-4 py-2 text-right">To Date</th>
                      <th className="px-4 py-2 text-right">Rate</th>
                      <th className="px-4 py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {claimDetail.line_items?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50 text-sm">
                        <td className="px-4 py-2">
                          <span className="font-mono text-xs text-gray-500">{item.wbs_code}</span>
                          <span className="ml-2">{item.wbs_name}</span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {item.contract_quantity} {item.unit}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-gray-500">
                          {item.previous_quantity}
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-medium">
                          {item.this_quantity}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {item.to_date_quantity}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          ${item.rate.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-medium">
                          {formatCurrency(item.this_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-medium">
                      <td colSpan={6} className="px-4 py-2 text-right">Total This Claim</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {formatCurrency(claimDetail.gross_amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="card p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Claim</h3>
              <p className="text-gray-500">
                Click on a claim from the list to view details, or create a new claim.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Claim Modal */}
      {showCreateClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card w-full max-w-md">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Create Progress Claim</h2>
            </div>
            <form onSubmit={handleCreateClaim} className="p-4 space-y-4">
              <div>
                <label className="label">Claim Period Start</label>
                <input
                  type="date"
                  value={newClaimPeriod.start}
                  onChange={(e) => setNewClaimPeriod({ ...newClaimPeriod, start: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Claim Period End</label>
                <input
                  type="date"
                  value={newClaimPeriod.end}
                  onChange={(e) => setNewClaimPeriod({ ...newClaimPeriod, end: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <p className="text-sm text-gray-500">
                The claim will be automatically populated with completed quantities from daily logs.
              </p>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateClaim(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1" disabled={createClaimMutation.isPending}>
                  {createClaimMutation.isPending ? 'Creating...' : 'Create Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
