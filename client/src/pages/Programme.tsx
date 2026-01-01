import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { mappingsApi, projectsApi } from '../services/api';
import { formatDate, formatShortDate } from '../utils/format';
import {
  ArrowLeft, Calendar, RefreshCw, ChevronRight, ChevronDown,
  Plus, Edit2, Trash2, X, Save,
  AlertCircle, CheckCircle
} from 'lucide-react';
import type { ProgrammeTask } from '../types';

export default function Programme() {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<ProgrammeTask | null>(null);
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['programme-tasks', projectId],
    queryFn: () => mappingsApi.programmeTasks.list(projectId!),
  });

  const { data: validation } = useQuery({
    queryKey: ['mapping-validation', projectId],
    queryFn: () => mappingsApi.validation(projectId!),
  });

  const recalculateMutation = useMutation({
    mutationFn: () => mappingsApi.programmeTasks.recalculate(projectId!, startDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programme-tasks', projectId] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => mappingsApi.programmeTasks.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programme-tasks', projectId] });
      setShowAddModal(false);
      setParentTaskId(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => mappingsApi.programmeTasks.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programme-tasks', projectId] });
      setEditingTask(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mappingsApi.programmeTasks.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programme-tasks', projectId] });
    },
  });

  // Build hierarchical structure
  const buildHierarchy = (items: ProgrammeTask[], parentId: string | null = null): ProgrammeTask[] => {
    return items
      .filter(item => item.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(item => ({
        ...item,
        children: buildHierarchy(items, item.id),
      }));
  };

  const hierarchicalTasks = buildHierarchy(tasks);

  // Flatten for display (respecting expansion)
  const flattenTasks = (items: any[], expanded: Set<string>): ProgrammeTask[] => {
    const result: ProgrammeTask[] = [];
    for (const item of items) {
      result.push(item);
      if (item.children?.length > 0 && expanded.has(item.id)) {
        result.push(...flattenTasks(item.children, expanded));
      }
    }
    return result;
  };

  const displayTasks = flattenTasks(hierarchicalTasks, expandedTasks);

  // Filter to items with duration for Gantt
  const programmeItems = tasks.filter((item: any) => item.duration_days > 0);

  // Calculate date range for Gantt
  const allDates = programmeItems.flatMap((item: any) => [
    item.start_date ? new Date(item.start_date) : null,
    item.end_date ? new Date(item.end_date) : null,
  ]).filter(Boolean) as Date[];

  const minDate = allDates.length > 0
    ? new Date(Math.min(...allDates.map(d => d.getTime())))
    : new Date();
  const maxDate = allDates.length > 0
    ? new Date(Math.max(...allDates.map(d => d.getTime())))
    : new Date();

  minDate.setDate(minDate.getDate() - 7);
  maxDate.setDate(maxDate.getDate() + 14);

  // Generate weeks
  const weeks: { start: Date; end: Date; label: string }[] = [];
  let currentWeekStart = new Date(minDate);
  currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());

  while (currentWeekStart <= maxDate) {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weeks.push({
      start: new Date(currentWeekStart),
      end: weekEnd,
      label: formatShortDate(currentWeekStart.toISOString()),
    });
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }

  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));

  const getBarPosition = (item: any) => {
    if (!item.start_date || !item.end_date) return null;

    const start = new Date(item.start_date);
    const end = new Date(item.end_date);

    const startOffset = Math.max(0, (start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

    const leftPercent = (startOffset / totalDays) * 100;
    const widthPercent = (duration / totalDays) * 100;

    return { left: `${leftPercent}%`, width: `${Math.max(widthPercent, 1)}%` };
  };

  const getBarColor = (level: number, hasMappings: boolean) => {
    if (!hasMappings) return 'bg-gray-400';
    switch (level) {
      case 1: return 'bg-primary-600';
      case 2: return 'bg-primary-400';
      default: return 'bg-primary-300';
    }
  };

  const toggleExpand = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const hasChildren = (taskId: string) => tasks.some((t: ProgrammeTask) => t.parent_id === taskId);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Programme</h1>
            <p className="text-gray-500">{project?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Validation Status */}
          {validation && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              validation.summary.is_complete
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {validation.summary.is_complete
                ? <CheckCircle className="w-4 h-4" />
                : <AlertCircle className="w-4 h-4" />
              }
              {validation.summary.coverage_percent}% mapped
            </div>
          )}
          <button
            onClick={() => { setParentTaskId(null); setShowAddModal(true); }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>
      </div>

      {/* Recalculate Controls */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">Project Start:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input w-40"
              />
            </div>
          </div>
          <button
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
            className="btn btn-primary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
            Recalculate Dates
          </button>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="card overflow-hidden">
        {/* Header with weeks */}
        <div className="flex border-b border-gray-200">
          <div className="w-96 flex-shrink-0 px-4 py-2 bg-gray-50 font-medium text-sm text-gray-600 border-r border-gray-200">
            Activity
          </div>
          <div className="w-24 flex-shrink-0 px-2 py-2 bg-gray-50 text-xs text-center text-gray-500 border-r border-gray-200">
            Cost Links
          </div>
          <div className="flex-1 flex bg-gray-50">
            {weeks.map((week, idx) => (
              <div
                key={idx}
                className="flex-1 px-2 py-2 text-xs text-center text-gray-500 border-r border-gray-100 min-w-[60px]"
              >
                {week.label}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading programme...</div>
        ) : displayTasks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No programme tasks yet. Click "Add Task" to create your first task.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {displayTasks.map((item: any) => {
              const barPosition = getBarPosition(item);
              const hasChildTasks = hasChildren(item.id);
              const isExpanded = expandedTasks.has(item.id);
              const hasMappings = (item.wbs_mapping_count || 0) > 0;

              return (
                <div key={item.id} className="flex hover:bg-gray-50 group">
                  {/* Activity name */}
                  <div
                    className="w-96 flex-shrink-0 px-4 py-3 border-r border-gray-200 flex items-center gap-2"
                    style={{ paddingLeft: `${item.level * 16 + 16}px` }}
                  >
                    {hasChildTasks ? (
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="p-0.5 hover:bg-gray-200 rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    ) : (
                      <span className="w-5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${item.level === 1 ? 'font-semibold' : ''} truncate block`}>
                        {item.code && `${item.code} - `}{item.name}
                      </span>
                      <div className="text-xs text-gray-400">
                        {item.duration_days > 0 ? (
                          <>{item.duration_days}d | {formatShortDate(item.start_date)} - {formatShortDate(item.end_date)}</>
                        ) : (
                          <span className="text-amber-500">No duration set</span>
                        )}
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                      <button
                        onClick={() => { setParentTaskId(item.id); setShowAddModal(true); }}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"
                        title="Add child task"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingTask(item)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"
                        title="Edit task"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this task?')) deleteMutation.mutate(item.id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded text-red-500"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* WBS mapping indicator */}
                  <div className="w-24 flex-shrink-0 px-2 py-3 border-r border-gray-200 flex items-center justify-center">
                    {hasMappings ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        {item.wbs_mapping_count} linked
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                        unmapped
                      </span>
                    )}
                  </div>

                  {/* Gantt bar area */}
                  <div className="flex-1 relative py-3">
                    {barPosition && (
                      <div
                        className={`absolute h-6 rounded ${getBarColor(item.level, hasMappings)} opacity-90`}
                        style={{
                          left: barPosition.left,
                          width: barPosition.width,
                          top: '50%',
                          transform: 'translateY(-50%)',
                        }}
                      >
                        <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium truncate px-2">
                          {item.duration_days}d
                        </span>
                      </div>
                    )}

                    {/* Week grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {weeks.map((_, idx) => (
                        <div key={idx} className="flex-1 border-r border-gray-100" />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="mt-6 card p-6">
        <h3 className="font-medium mb-4">Programme Summary</h3>
        <div className="grid grid-cols-5 gap-8">
          <div>
            <p className="text-sm text-gray-500">Total Tasks</p>
            <p className="text-2xl font-bold">{tasks.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Mapped Tasks</p>
            <p className="text-2xl font-bold text-green-600">
              {validation?.summary.mapped_tasks || 0}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Project Start</p>
            <p className="text-2xl font-bold">
              {programmeItems.length > 0 && programmeItems[0].start_date
                ? formatDate(programmeItems[0].start_date)
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Project End</p>
            <p className="text-2xl font-bold">
              {programmeItems.length > 0
                ? formatDate(programmeItems.reduce((latest: any, item: any) =>
                    !latest || (item.end_date && item.end_date > latest) ? item.end_date : latest
                  , null))
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Duration</p>
            <p className="text-2xl font-bold">
              {programmeItems.length > 0
                ? `${Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24 * 7))} weeks`
                : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingTask) && (
        <TaskModal
          task={editingTask}
          parentId={parentTaskId}
          tasks={tasks}
          onClose={() => { setShowAddModal(false); setEditingTask(null); setParentTaskId(null); }}
          onSave={(data) => {
            if (editingTask) {
              updateMutation.mutate({ id: editingTask.id, data });
            } else {
              createMutation.mutate({
                ...data,
                project_id: projectId,
                parent_id: parentTaskId,
                level: parentTaskId
                  ? (tasks.find((t: ProgrammeTask) => t.id === parentTaskId)?.level || 0) + 1
                  : 1,
              });
            }
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
}

// Task Modal Component
interface TaskModalProps {
  task: ProgrammeTask | null;
  parentId: string | null;
  tasks: ProgrammeTask[];
  onClose: () => void;
  onSave: (data: any) => void;
  isLoading: boolean;
}

function TaskModal({ task, parentId, tasks, onClose, onSave, isLoading }: TaskModalProps) {
  const [formData, setFormData] = useState({
    code: task?.code || '',
    name: task?.name || '',
    description: task?.description || '',
    duration_days: task?.duration_days || 0,
    predecessor_id: task?.predecessor_id || '',
    predecessor_lag_days: task?.predecessor_lag_days || 0,
    percent_complete: task?.percent_complete || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  // Get available predecessors (same level tasks)
  const parentLevel = parentId
    ? (tasks.find(t => t.id === parentId)?.level || 0) + 1
    : 1;
  const availablePredecessors = tasks.filter(t =>
    t.level === (task?.level || parentLevel) && t.id !== task?.id
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {task ? 'Edit Task' : 'Add Task'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="input w-full"
                placeholder="e.g., 1.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
              <input
                type="number"
                value={formData.duration_days}
                onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) || 0 })}
                className="input w-full"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full"
              placeholder="Task name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input w-full"
              rows={2}
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Predecessor</label>
              <select
                value={formData.predecessor_id}
                onChange={(e) => setFormData({ ...formData, predecessor_id: e.target.value })}
                className="input w-full"
              >
                <option value="">None</option>
                {availablePredecessors.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code || ''} {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lag (days)</label>
              <input
                type="number"
                value={formData.predecessor_lag_days}
                onChange={(e) => setFormData({ ...formData, predecessor_lag_days: parseInt(e.target.value) || 0 })}
                className="input w-full"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">% Complete</label>
            <input
              type="number"
              value={formData.percent_complete}
              onChange={(e) => setFormData({ ...formData, percent_complete: parseFloat(e.target.value) || 0 })}
              className="input w-32"
              min="0"
              max="100"
              step="5"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" />
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
