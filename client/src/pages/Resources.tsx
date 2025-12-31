import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resourcesApi } from '../services/api';
import { formatCurrency } from '../utils/format';
import { Plus, Truck, Users, Package, Hammer, Edit2, Trash2, X } from 'lucide-react';

type ResourceTab = 'plant' | 'labour' | 'materials' | 'subcontractors';

export default function Resources() {
  const [activeTab, setActiveTab] = useState<ResourceTab>('plant');
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: plantTypes = [] } = useQuery({
    queryKey: ['resources', 'plant'],
    queryFn: resourcesApi.plant.list,
    enabled: activeTab === 'plant',
  });

  const { data: labourTypes = [] } = useQuery({
    queryKey: ['resources', 'labour'],
    queryFn: resourcesApi.labour.list,
    enabled: activeTab === 'labour',
  });

  const { data: materialTypes = [] } = useQuery({
    queryKey: ['resources', 'materials'],
    queryFn: resourcesApi.materials.list,
    enabled: activeTab === 'materials',
  });

  const { data: subcontractorTypes = [] } = useQuery({
    queryKey: ['resources', 'subcontractors'],
    queryFn: resourcesApi.subcontractors.list,
    enabled: activeTab === 'subcontractors',
  });

  const createPlantMutation = useMutation({
    mutationFn: resourcesApi.plant.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', 'plant'] });
      setShowAddModal(false);
    },
  });

  const createLabourMutation = useMutation({
    mutationFn: resourcesApi.labour.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', 'labour'] });
      setShowAddModal(false);
    },
  });

  const createMaterialMutation = useMutation({
    mutationFn: resourcesApi.materials.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', 'materials'] });
      setShowAddModal(false);
    },
  });

  const createSubconMutation = useMutation({
    mutationFn: resourcesApi.subcontractors.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', 'subcontractors'] });
      setShowAddModal(false);
    },
  });

  const deletePlantMutation = useMutation({
    mutationFn: resourcesApi.plant.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resources', 'plant'] }),
  });

  const deleteLabourMutation = useMutation({
    mutationFn: resourcesApi.labour.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resources', 'labour'] }),
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: resourcesApi.materials.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resources', 'materials'] }),
  });

  const deleteSubconMutation = useMutation({
    mutationFn: resourcesApi.subcontractors.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resources', 'subcontractors'] }),
  });

  const [formData, setFormData] = useState<any>({});

  const tabs = [
    { id: 'plant', label: 'Plant', icon: Truck, count: plantTypes.length },
    { id: 'labour', label: 'Labour', icon: Users, count: labourTypes.length },
    { id: 'materials', label: 'Materials', icon: Package, count: materialTypes.length },
    { id: 'subcontractors', label: 'Subcontractors', icon: Hammer, count: subcontractorTypes.length },
  ];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    switch (activeTab) {
      case 'plant':
        createPlantMutation.mutate(formData);
        break;
      case 'labour':
        createLabourMutation.mutate(formData);
        break;
      case 'materials':
        createMaterialMutation.mutate(formData);
        break;
      case 'subcontractors':
        createSubconMutation.mutate(formData);
        break;
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this resource?')) return;
    switch (activeTab) {
      case 'plant':
        deletePlantMutation.mutate(id);
        break;
      case 'labour':
        deleteLabourMutation.mutate(id);
        break;
      case 'materials':
        deleteMaterialMutation.mutate(id);
        break;
      case 'subcontractors':
        deleteSubconMutation.mutate(id);
        break;
    }
  };

  const openAddModal = () => {
    setFormData({});
    setShowAddModal(true);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resource Library</h1>
          <p className="text-gray-500">Manage your plant, labour, materials, and subcontractor rates</p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ResourceTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Plant Table */}
      {activeTab === 'plant' && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Hourly Rate</th>
                <th className="px-4 py-3 text-right">Hire Rate</th>
                <th className="px-4 py-3 text-right">Mob Cost</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {plantTypes.map((plant: any) => (
                <tr key={plant.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{plant.code}</td>
                  <td className="px-4 py-3">{plant.description}</td>
                  <td className="px-4 py-3 capitalize">{plant.ownership_type}</td>
                  <td className="px-4 py-3 text-right font-mono">${plant.hourly_rate}/hr</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500">${plant.hire_rate}/hr</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500">{formatCurrency(plant.mobilisation_cost)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(plant.id)} className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Labour Table */}
      {activeTab === 'labour' && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Hourly Rate</th>
                <th className="px-4 py-3 text-right">OT 1.5x</th>
                <th className="px-4 py-3 text-right">OT 2x</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {labourTypes.map((labour: any) => (
                <tr key={labour.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{labour.code}</td>
                  <td className="px-4 py-3">{labour.role}</td>
                  <td className="px-4 py-3 text-right font-mono">${labour.hourly_rate}/hr</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500">${labour.overtime_rate_1_5}/hr</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500">${labour.overtime_rate_2}/hr</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(labour.id)} className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Materials Table */}
      {activeTab === 'materials' && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">Base Rate</th>
                <th className="px-4 py-3 text-right">Lead Time</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {materialTypes.map((material: any) => (
                <tr key={material.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{material.code}</td>
                  <td className="px-4 py-3">{material.description}</td>
                  <td className="px-4 py-3">{material.unit}</td>
                  <td className="px-4 py-3 text-right font-mono">${material.base_rate}/{material.unit}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{material.lead_time_days} days</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(material.id)} className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Subcontractors Table */}
      {activeTab === 'subcontractors' && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Trade</th>
                <th className="px-4 py-3">Rate Type</th>
                <th className="px-4 py-3 text-right">Default Rate</th>
                <th className="px-4 py-3 text-right">Retention</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subcontractorTypes.map((subcon: any) => (
                <tr key={subcon.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{subcon.code}</td>
                  <td className="px-4 py-3">{subcon.trade}</td>
                  <td className="px-4 py-3 capitalize">{subcon.rate_type.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(subcon.default_rate)}</td>
                  <td className="px-4 py-3 text-right">{subcon.retention_percent}%</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(subcon.id)} className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card w-full max-w-md">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              {activeTab === 'plant' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Code</label>
                      <input type="text" className="input" required onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Type</label>
                      <select className="input" onChange={(e) => setFormData({ ...formData, ownership_type: e.target.value })}>
                        <option value="owned">Owned</option>
                        <option value="hired">Hired</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <input type="text" className="input" required onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Hourly Rate ($)</label>
                      <input type="number" className="input" step="0.01" onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })} />
                    </div>
                    <div>
                      <label className="label">Hire Rate ($)</label>
                      <input type="number" className="input" step="0.01" onChange={(e) => setFormData({ ...formData, hire_rate: parseFloat(e.target.value) })} />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'labour' && (
                <>
                  <div>
                    <label className="label">Code</label>
                    <input type="text" className="input" required onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Role</label>
                    <input type="text" className="input" required onChange={(e) => setFormData({ ...formData, role: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Hourly Rate ($)</label>
                    <input type="number" className="input" step="0.01" onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })} />
                  </div>
                </>
              )}

              {activeTab === 'materials' && (
                <>
                  <div>
                    <label className="label">Code</label>
                    <input type="text" className="input" required onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <input type="text" className="input" required onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Unit</label>
                      <input type="text" className="input" placeholder="m3, m2, each" onChange={(e) => setFormData({ ...formData, unit: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Base Rate ($)</label>
                      <input type="number" className="input" step="0.01" onChange={(e) => setFormData({ ...formData, base_rate: parseFloat(e.target.value) })} />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'subcontractors' && (
                <>
                  <div>
                    <label className="label">Code</label>
                    <input type="text" className="input" required onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Trade</label>
                    <input type="text" className="input" required onChange={(e) => setFormData({ ...formData, trade: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Rate Type</label>
                      <select className="input" onChange={(e) => setFormData({ ...formData, rate_type: e.target.value })}>
                        <option value="lump_sum">Lump Sum</option>
                        <option value="measure_value">Measure & Value</option>
                        <option value="hourly">Hourly</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Default Rate ($)</label>
                      <input type="number" className="input" step="0.01" onChange={(e) => setFormData({ ...formData, default_rate: parseFloat(e.target.value) })} />
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
