import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../services/api';
import { Settings as SettingsIcon, Save, RefreshCw, Play } from 'lucide-react';

export default function Settings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });

  const [formData, setFormData] = useState<any>(null);

  const updateMutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const seedMutation = useMutation({
    mutationFn: settingsApi.seedDemo,
    onSuccess: () => {
      queryClient.invalidateQueries();
      alert('Demo data loaded successfully!');
    },
  });

  // Initialize form data when settings load
  if (settings && !formData) {
    setFormData(settings);
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleReset = () => {
    setFormData(settings);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-gray-100 rounded-lg">
          <SettingsIcon className="w-6 h-6 text-gray-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500">Configure company defaults and preferences</p>
        </div>
      </div>

      {formData && (
        <form onSubmit={handleSave} className="space-y-8">
          {/* Company Details */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Company Details</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="label">Company Name</label>
                <input
                  type="text"
                  value={formData.company_name || ''}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Head Office Monthly Cost ($)</label>
                <input
                  type="number"
                  value={formData.head_office_monthly_cost || 0}
                  onChange={(e) => setFormData({ ...formData, head_office_monthly_cost: parseFloat(e.target.value) })}
                  className="input"
                  step="1000"
                />
                <p className="text-sm text-gray-500 mt-1">Used in company cashflow calculations</p>
              </div>
              <div>
                <label className="label">Bank Facility Limit ($)</label>
                <input
                  type="number"
                  value={formData.bank_facility_limit || 0}
                  onChange={(e) => setFormData({ ...formData, bank_facility_limit: parseFloat(e.target.value) })}
                  className="input"
                  step="10000"
                />
                <p className="text-sm text-gray-500 mt-1">Used for cashflow alerts</p>
              </div>
            </div>
          </div>

          {/* Project Defaults */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Project Defaults</h2>
            <p className="text-sm text-gray-500 mb-4">These values are used as defaults when creating new projects</p>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="label">Default Retention (%)</label>
                <input
                  type="number"
                  value={formData.default_retention_percent || 5}
                  onChange={(e) => setFormData({ ...formData, default_retention_percent: parseFloat(e.target.value) })}
                  className="input"
                  step="0.5"
                  min="0"
                  max="20"
                />
              </div>
              <div>
                <label className="label">Default Payment Terms (days)</label>
                <input
                  type="number"
                  value={formData.default_payment_terms_days || 30}
                  onChange={(e) => setFormData({ ...formData, default_payment_terms_days: parseInt(e.target.value) })}
                  className="input"
                  min="0"
                  max="90"
                />
              </div>
              <div>
                <label className="label">GST Rate (%)</label>
                <input
                  type="number"
                  value={(formData.gst_rate || 0.15) * 100}
                  onChange={(e) => setFormData({ ...formData, gst_rate: parseFloat(e.target.value) / 100 })}
                  className="input"
                  step="0.5"
                  min="0"
                  max="25"
                />
              </div>
            </div>
          </div>

          {/* Tender Defaults */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Tender Build-Up Defaults</h2>
            <p className="text-sm text-gray-500 mb-4">Default percentages for tender pricing build-up</p>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="label">Contingency (%)</label>
                <input
                  type="number"
                  value={formData.default_contingency_percent || 5}
                  onChange={(e) => setFormData({ ...formData, default_contingency_percent: parseFloat(e.target.value) })}
                  className="input"
                  step="0.5"
                  min="0"
                  max="20"
                />
              </div>
              <div>
                <label className="label">Overhead (%)</label>
                <input
                  type="number"
                  value={formData.default_overhead_percent || 8}
                  onChange={(e) => setFormData({ ...formData, default_overhead_percent: parseFloat(e.target.value) })}
                  className="input"
                  step="0.5"
                  min="0"
                  max="20"
                />
              </div>
              <div>
                <label className="label">Target Margin (%)</label>
                <input
                  type="number"
                  value={formData.default_margin_percent || 6}
                  onChange={(e) => setFormData({ ...formData, default_margin_percent: parseFloat(e.target.value) })}
                  className="input"
                  step="0.5"
                  min="0"
                  max="30"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-secondary flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </form>
      )}

      {/* Demo Data */}
      <div className="card p-6 mt-8 bg-gray-50">
        <h2 className="text-lg font-semibold mb-2">Demo Data</h2>
        <p className="text-sm text-gray-600 mb-4">
          Load sample data including plant, labour, materials, and a demo project to explore the system.
          This will clear any existing data.
        </p>
        <button
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          className="btn btn-secondary flex items-center gap-2"
        >
          <Play className="w-4 h-4" />
          {seedMutation.isPending ? 'Loading...' : 'Load Demo Data'}
        </button>
      </div>
    </div>
  );
}
