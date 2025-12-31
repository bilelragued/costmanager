import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { mappingsApi, projectsApi, wbsApi } from '../services/api';
import { formatCurrency } from '../utils/format';
import {
  ArrowLeft, Link as LinkIcon, Grid3X3, List, AlertTriangle,
  CheckCircle, Plus, Trash2, Save, X, Percent, DollarSign, Search
} from 'lucide-react';
import type { ProgrammeTask, ProgrammeWbsMapping, WBSItem, MappingValidation } from '../types';

type ViewMode = 'matrix' | 'list';
type Tab = 'mappings' | 'validation' | 'rules';

export default function Mappings() {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [activeTab, setActiveTab] = useState<Tab>('mappings');
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [selectedWbs, setSelectedWbs] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [searchTasks, setSearchTasks] = useState('');
  const [searchWbs, setSearchWbs] = useState('');

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['programme-tasks', projectId],
    queryFn: () => mappingsApi.programmeTasks.list(projectId!),
  });

  const { data: wbsItems = [] } = useQuery({
    queryKey: ['wbs', projectId],
    queryFn: () => wbsApi.listByProject(projectId!),
  });

  const { data: mappings = [] } = useQuery({
    queryKey: ['programme-wbs-mappings', projectId],
    queryFn: () => mappingsApi.programmeWbs.listByProject(projectId!),
  });

  const { data: validation } = useQuery({
    queryKey: ['mapping-validation', projectId],
    queryFn: () => mappingsApi.validation(projectId!),
  });

  const createMappingMutation = useMutation({
    mutationFn: (data: any) => mappingsApi.programmeWbs.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programme-wbs-mappings', projectId] });
      queryClient.invalidateQueries({ queryKey: ['mapping-validation', projectId] });
      queryClient.invalidateQueries({ queryKey: ['programme-tasks', projectId] });
      setShowLinkModal(false);
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: (id: string) => mappingsApi.programmeWbs.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programme-wbs-mappings', projectId] });
      queryClient.invalidateQueries({ queryKey: ['mapping-validation', projectId] });
      queryClient.invalidateQueries({ queryKey: ['programme-tasks', projectId] });
    },
  });

  const updateMappingMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => mappingsApi.programmeWbs.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programme-wbs-mappings', projectId] });
    },
  });

  // Build mapping lookup
  const mappingLookup: { [key: string]: ProgrammeWbsMapping } = {};
  mappings.forEach((m: ProgrammeWbsMapping) => {
    mappingLookup[`${m.programme_task_id}-${m.wbs_item_id}`] = m;
  });

  // Filter items based on search
  const filteredTasks = tasks.filter((t: ProgrammeTask) =>
    t.name.toLowerCase().includes(searchTasks.toLowerCase()) ||
    (t.code || '').toLowerCase().includes(searchTasks.toLowerCase())
  );

  const filteredWbs = wbsItems.filter((w: WBSItem) =>
    w.name.toLowerCase().includes(searchWbs.toLowerCase()) ||
    w.code.toLowerCase().includes(searchWbs.toLowerCase())
  );

  // Get mapping for cell
  const getCellMapping = (taskId: string, wbsId: string) => {
    return mappingLookup[`${taskId}-${wbsId}`];
  };

  // Toggle mapping
  const handleCellClick = (taskId: string, wbsId: string) => {
    const existing = getCellMapping(taskId, wbsId);
    if (existing) {
      if (confirm('Remove this mapping?')) {
        deleteMappingMutation.mutate(existing.id);
      }
    } else {
      setSelectedTask(taskId);
      setSelectedWbs(wbsId);
      setShowLinkModal(true);
    }
  };

  // Quick link (100% allocation)
  const handleQuickLink = (taskId: string, wbsId: string) => {
    createMappingMutation.mutate({
      project_id: projectId,
      programme_task_id: taskId,
      wbs_item_id: wbsId,
      allocation_type: 'percent',
      allocation_percent: 100,
    });
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to={`/projects/${projectId}/programme`} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mapping Dashboard</h1>
            <p className="text-gray-500">{project?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Validation Status */}
          {validation && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              validation.summary.is_complete
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {validation.summary.is_complete
                ? <CheckCircle className="w-5 h-5" />
                : <AlertTriangle className="w-5 h-5" />
              }
              <div>
                <span className="font-medium">{validation.summary.coverage_percent}% Coverage</span>
                <span className="text-sm ml-2">
                  ({validation.summary.mapped_tasks}/{validation.summary.total_tasks} tasks,
                  {validation.summary.mapped_wbs}/{validation.summary.total_wbs} WBS)
                </span>
              </div>
            </div>
          )}
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'matrix' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
            >
              <Grid3X3 className="w-4 h-4 inline mr-1" />
              Matrix
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
            >
              <List className="w-4 h-4 inline mr-1" />
              List
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        <button
          onClick={() => setActiveTab('mappings')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'mappings'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <LinkIcon className="w-4 h-4 inline mr-2" />
          Programme-WBS Mappings
        </button>
        <button
          onClick={() => setActiveTab('validation')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'validation'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          Validation Issues
          {validation && validation.summary.unmapped_tasks + validation.summary.unmapped_wbs > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
              {validation.summary.unmapped_tasks + validation.summary.unmapped_wbs}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {activeTab === 'mappings' && viewMode === 'matrix' && (
        <MatrixView
          tasks={filteredTasks}
          wbsItems={filteredWbs}
          mappingLookup={mappingLookup}
          searchTasks={searchTasks}
          setSearchTasks={setSearchTasks}
          searchWbs={searchWbs}
          setSearchWbs={setSearchWbs}
          onCellClick={handleCellClick}
          onQuickLink={handleQuickLink}
        />
      )}

      {activeTab === 'mappings' && viewMode === 'list' && (
        <ListView
          mappings={mappings}
          onDelete={(id) => {
            if (confirm('Remove this mapping?')) {
              deleteMappingMutation.mutate(id);
            }
          }}
          onUpdate={(id, data) => updateMappingMutation.mutate({ id, data })}
        />
      )}

      {activeTab === 'validation' && validation && (
        <ValidationView
          validation={validation}
          tasks={tasks}
          wbsItems={wbsItems}
          onQuickLink={handleQuickLink}
        />
      )}

      {/* Link Modal */}
      {showLinkModal && selectedTask && selectedWbs && (
        <LinkModal
          taskId={selectedTask}
          wbsId={selectedWbs}
          projectId={projectId!}
          tasks={tasks}
          wbsItems={wbsItems}
          onClose={() => { setShowLinkModal(false); setSelectedTask(null); setSelectedWbs(null); }}
          onSave={(data) => createMappingMutation.mutate(data)}
          isLoading={createMappingMutation.isPending}
        />
      )}
    </div>
  );
}

// Matrix View Component
interface MatrixViewProps {
  tasks: ProgrammeTask[];
  wbsItems: WBSItem[];
  mappingLookup: { [key: string]: ProgrammeWbsMapping };
  searchTasks: string;
  setSearchTasks: (v: string) => void;
  searchWbs: string;
  setSearchWbs: (v: string) => void;
  onCellClick: (taskId: string, wbsId: string) => void;
  onQuickLink: (taskId: string, wbsId: string) => void;
}

function MatrixView({
  tasks, wbsItems, mappingLookup, searchTasks, setSearchTasks,
  searchWbs, setSearchWbs, onCellClick, onQuickLink
}: MatrixViewProps) {
  return (
    <div className="card overflow-hidden">
      {/* Search Filters */}
      <div className="p-4 border-b bg-gray-50 flex gap-4">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTasks}
            onChange={(e) => setSearchTasks(e.target.value)}
            placeholder="Search tasks..."
            className="input flex-1"
          />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchWbs}
            onChange={(e) => setSearchWbs(e.target.value)}
            placeholder="Search WBS items..."
            className="input flex-1"
          />
        </div>
      </div>

      <div className="overflow-auto max-h-[600px]">
        <table className="w-full">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th className="p-3 text-left text-sm font-medium text-gray-600 border-b border-r bg-gray-100 sticky left-0 z-20 min-w-[200px]">
                Task \ WBS
              </th>
              {wbsItems.map((wbs: WBSItem) => (
                <th
                  key={wbs.id}
                  className="p-2 text-xs font-medium text-gray-600 border-b border-r min-w-[80px] max-w-[120px]"
                >
                  <div className="truncate" title={`${wbs.code} - ${wbs.name}`}>
                    {wbs.code}
                  </div>
                  <div className="text-gray-400 font-normal truncate">{wbs.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={wbsItems.length + 1} className="p-8 text-center text-gray-500">
                  No programme tasks found. Create tasks in the Programme page first.
                </td>
              </tr>
            ) : (
              tasks.map((task: ProgrammeTask) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td
                    className="p-3 text-sm border-b border-r bg-white sticky left-0 z-10"
                    style={{ paddingLeft: `${task.level * 12 + 12}px` }}
                  >
                    <div className="font-medium truncate" title={`${task.code || ''} ${task.name}`}>
                      {task.code && <span className="text-gray-400 mr-1">{task.code}</span>}
                      {task.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {task.duration_days}d
                    </div>
                  </td>
                  {wbsItems.map((wbs: WBSItem) => {
                    const mapping = mappingLookup[`${task.id}-${wbs.id}`];
                    return (
                      <td
                        key={wbs.id}
                        className="p-1 text-center border-b border-r cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => onCellClick(task.id, wbs.id)}
                        onDoubleClick={() => !mapping && onQuickLink(task.id, wbs.id)}
                      >
                        {mapping ? (
                          <div className="flex items-center justify-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              mapping.allocation_percent === 100
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {mapping.allocation_percent}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-lg">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-gray-50 border-t text-sm text-gray-500">
        Click cell to add/remove mapping. Double-click empty cell for quick 100% link.
      </div>
    </div>
  );
}

// List View Component
interface ListViewProps {
  mappings: ProgrammeWbsMapping[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: any) => void;
}

function ListView({ mappings, onDelete, onUpdate }: ListViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPercent, setEditPercent] = useState<number>(100);

  return (
    <div className="card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-3 text-left text-sm font-medium text-gray-600">Programme Task</th>
              <th className="p-3 text-left text-sm font-medium text-gray-600">WBS Item</th>
              <th className="p-3 text-left text-sm font-medium text-gray-600">WBS Budget</th>
              <th className="p-3 text-center text-sm font-medium text-gray-600">Allocation</th>
              <th className="p-3 text-left text-sm font-medium text-gray-600">Allocated Value</th>
              <th className="p-3 text-center text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {mappings.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No mappings yet. Use the Matrix view to create mappings.
                </td>
              </tr>
            ) : (
              mappings.map((mapping: ProgrammeWbsMapping) => (
                <tr key={mapping.id} className="hover:bg-gray-50">
                  <td className="p-3">
                    <div className="font-medium text-sm">
                      {mapping.task_code && <span className="text-gray-400 mr-1">{mapping.task_code}</span>}
                      {mapping.task_name}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-sm">
                      <span className="text-gray-400 mr-1">{mapping.wbs_code}</span>
                      {mapping.wbs_name}
                    </div>
                  </td>
                  <td className="p-3 text-sm">
                    {formatCurrency(mapping.wbs_budget || 0)}
                  </td>
                  <td className="p-3 text-center">
                    {editingId === mapping.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          value={editPercent}
                          onChange={(e) => setEditPercent(parseFloat(e.target.value) || 0)}
                          className="input w-20 text-center"
                          min="0"
                          max="100"
                        />
                        <span>%</span>
                        <button
                          onClick={() => {
                            onUpdate(mapping.id, { allocation_percent: editPercent });
                            setEditingId(null);
                          }}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingId(mapping.id); setEditPercent(mapping.allocation_percent); }}
                        className={`px-3 py-1 rounded text-sm font-medium ${
                          mapping.allocation_percent === 100
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {mapping.allocation_percent}%
                      </button>
                    )}
                  </td>
                  <td className="p-3 text-sm font-medium">
                    {formatCurrency((mapping.wbs_budget || 0) * (mapping.allocation_percent / 100))}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => onDelete(mapping.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Remove mapping"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Validation View Component
interface ValidationViewProps {
  validation: MappingValidation;
  tasks: ProgrammeTask[];
  wbsItems: WBSItem[];
  onQuickLink: (taskId: string, wbsId: string) => void;
}

function ValidationView({ validation, tasks, wbsItems, onQuickLink }: ValidationViewProps) {
  const [selectedUnmappedTask, setSelectedUnmappedTask] = useState<string | null>(null);
  const [selectedUnmappedWbs, setSelectedUnmappedWbs] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-sm text-gray-500">Total Tasks</div>
          <div className="text-2xl font-bold">{validation.summary.total_tasks}</div>
          <div className="text-sm text-green-600">{validation.summary.mapped_tasks} mapped</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-500">Total WBS Items</div>
          <div className="text-2xl font-bold">{validation.summary.total_wbs}</div>
          <div className="text-sm text-green-600">{validation.summary.mapped_wbs} mapped</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-500">Total Mappings</div>
          <div className="text-2xl font-bold">{validation.summary.total_mappings}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-500">Coverage</div>
          <div className={`text-2xl font-bold ${
            validation.summary.is_complete ? 'text-green-600' : 'text-amber-600'
          }`}>
            {validation.summary.coverage_percent}%
          </div>
        </div>
      </div>

      {/* Unmapped Tasks */}
      {validation.issues.unmapped_tasks.length > 0 && (
        <div className="card">
          <div className="p-4 border-b bg-amber-50">
            <h3 className="font-medium flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-5 h-5" />
              Unmapped Programme Tasks ({validation.issues.unmapped_tasks.length})
            </h3>
            <p className="text-sm text-amber-600 mt-1">
              These tasks have no WBS cost items linked. Select a task and WBS item to create a mapping.
            </p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Tasks List */}
              <div className="border rounded-lg overflow-hidden">
                <div className="p-2 bg-gray-50 text-sm font-medium">Unmapped Tasks</div>
                <div className="max-h-[300px] overflow-auto divide-y">
                  {validation.issues.unmapped_tasks.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedUnmappedTask(item.id)}
                      className={`w-full p-3 text-left hover:bg-gray-50 ${
                        selectedUnmappedTask === item.id ? 'bg-primary-50' : ''
                      }`}
                    >
                      <div className="font-medium text-sm">
                        {item.code && <span className="text-gray-400 mr-1">{item.code}</span>}
                        {item.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Link to WBS */}
              <div className="border rounded-lg overflow-hidden">
                <div className="p-2 bg-gray-50 text-sm font-medium">Link to WBS Item</div>
                <div className="max-h-[300px] overflow-auto divide-y">
                  {selectedUnmappedTask ? (
                    wbsItems.map((wbs: WBSItem) => (
                      <button
                        key={wbs.id}
                        onClick={() => onQuickLink(selectedUnmappedTask, wbs.id)}
                        className="w-full p-3 text-left hover:bg-green-50 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium text-sm">
                            <span className="text-gray-400 mr-1">{wbs.code}</span>
                            {wbs.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatCurrency(wbs.total_cost || 0)}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-green-600" />
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      Select a task on the left to link it to a WBS item
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unmapped WBS */}
      {validation.issues.unmapped_wbs.length > 0 && (
        <div className="card">
          <div className="p-4 border-b bg-amber-50">
            <h3 className="font-medium flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-5 h-5" />
              Unmapped WBS Items ({validation.issues.unmapped_wbs.length})
            </h3>
            <p className="text-sm text-amber-600 mt-1">
              These WBS cost items have no programme tasks linked.
            </p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* WBS List */}
              <div className="border rounded-lg overflow-hidden">
                <div className="p-2 bg-gray-50 text-sm font-medium">Unmapped WBS Items</div>
                <div className="max-h-[300px] overflow-auto divide-y">
                  {validation.issues.unmapped_wbs.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedUnmappedWbs(item.id)}
                      className={`w-full p-3 text-left hover:bg-gray-50 ${
                        selectedUnmappedWbs === item.id ? 'bg-primary-50' : ''
                      }`}
                    >
                      <div className="font-medium text-sm">
                        <span className="text-gray-400 mr-1">{item.code}</span>
                        {item.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Link to Task */}
              <div className="border rounded-lg overflow-hidden">
                <div className="p-2 bg-gray-50 text-sm font-medium">Link to Programme Task</div>
                <div className="max-h-[300px] overflow-auto divide-y">
                  {selectedUnmappedWbs ? (
                    tasks.map((task: ProgrammeTask) => (
                      <button
                        key={task.id}
                        onClick={() => onQuickLink(task.id, selectedUnmappedWbs)}
                        className="w-full p-3 text-left hover:bg-green-50 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium text-sm">
                            {task.code && <span className="text-gray-400 mr-1">{task.code}</span>}
                            {task.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {task.duration_days}d
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-green-600" />
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      Select a WBS item on the left to link it to a task
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Good */}
      {validation.summary.is_complete && (
        <div className="card p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-green-800">All mappings complete!</h3>
          <p className="text-gray-500 mt-2">
            All programme tasks and WBS items are properly linked.
          </p>
        </div>
      )}
    </div>
  );
}

// Link Modal Component
interface LinkModalProps {
  taskId: string;
  wbsId: string;
  projectId: string;
  tasks: ProgrammeTask[];
  wbsItems: WBSItem[];
  onClose: () => void;
  onSave: (data: any) => void;
  isLoading: boolean;
}

function LinkModal({ taskId, wbsId, projectId, tasks, wbsItems, onClose, onSave, isLoading }: LinkModalProps) {
  const task = tasks.find((t: ProgrammeTask) => t.id === taskId);
  const wbs = wbsItems.find((w: WBSItem) => w.id === wbsId);

  const [allocationType, setAllocationType] = useState<'percent' | 'fixed_value'>('percent');
  const [allocationPercent, setAllocationPercent] = useState(100);
  const [allocationValue, setAllocationValue] = useState(0);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      project_id: projectId,
      programme_task_id: taskId,
      wbs_item_id: wbsId,
      allocation_type: allocationType,
      allocation_percent: allocationType === 'percent' ? allocationPercent : null,
      allocation_value: allocationType === 'fixed_value' ? allocationValue : null,
      notes,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            Create Mapping
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Task & WBS Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Programme Task</div>
              <div className="font-medium text-sm">
                {task?.code && <span className="text-gray-400 mr-1">{task.code}</span>}
                {task?.name}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">WBS Item</div>
              <div className="font-medium text-sm">
                <span className="text-gray-400 mr-1">{wbs?.code}</span>
                {wbs?.name}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Budget: {formatCurrency(wbs?.total_cost || 0)}
              </div>
            </div>
          </div>

          {/* Allocation Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Allocation Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="allocationType"
                  checked={allocationType === 'percent'}
                  onChange={() => setAllocationType('percent')}
                  className="w-4 h-4"
                />
                <Percent className="w-4 h-4 text-gray-500" />
                Percentage
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="allocationType"
                  checked={allocationType === 'fixed_value'}
                  onChange={() => setAllocationType('fixed_value')}
                  className="w-4 h-4"
                />
                <DollarSign className="w-4 h-4 text-gray-500" />
                Fixed Value
              </label>
            </div>
          </div>

          {/* Allocation Value */}
          {allocationType === 'percent' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allocation %</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={allocationPercent}
                  onChange={(e) => setAllocationPercent(parseFloat(e.target.value) || 0)}
                  className="input w-32"
                  min="0"
                  max="100"
                  step="5"
                />
                <span className="text-gray-500">%</span>
                <span className="text-sm text-gray-400 ml-4">
                  = {formatCurrency((wbs?.total_cost || 0) * (allocationPercent / 100))}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fixed Value</label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">$</span>
                <input
                  type="number"
                  value={allocationValue}
                  onChange={(e) => setAllocationValue(parseFloat(e.target.value) || 0)}
                  className="input w-40"
                  min="0"
                  step="100"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input w-full"
              rows={2}
              placeholder="Add any notes about this mapping..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn btn-primary flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              {isLoading ? 'Creating...' : 'Create Mapping'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
