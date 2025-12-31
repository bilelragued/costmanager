import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { wbsApi, projectsApi } from '../services/api';
import { formatDate, formatShortDate } from '../utils/format';
import { ArrowLeft, Calendar, RefreshCw, ChevronRight } from 'lucide-react';

export default function Programme() {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
  });

  const { data: wbsItems = [], isLoading } = useQuery({
    queryKey: ['wbs', projectId],
    queryFn: () => wbsApi.listByProject(projectId!),
  });

  const recalculateMutation = useMutation({
    mutationFn: () => wbsApi.recalculateProgramme(projectId!, startDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wbs', projectId] });
    },
  });

  // Filter to items with duration
  const programmeItems = wbsItems.filter((item: any) => item.duration_days > 0);

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

  // Add some padding
  minDate.setDate(minDate.getDate() - 7);
  maxDate.setDate(maxDate.getDate() + 14);

  // Generate weeks
  const weeks: { start: Date; end: Date; label: string }[] = [];
  let currentWeekStart = new Date(minDate);
  currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay()); // Start on Sunday

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

  // Color based on level
  const getBarColor = (level: number) => {
    switch (level) {
      case 1: return 'bg-primary-600';
      case 2: return 'bg-primary-400';
      default: return 'bg-primary-300';
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
            <h1 className="text-2xl font-bold text-gray-900">Programme</h1>
            <p className="text-gray-500">{project?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input w-40"
            />
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
          <div className="w-80 flex-shrink-0 px-4 py-2 bg-gray-50 font-medium text-sm text-gray-600 border-r border-gray-200">
            Activity
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
        ) : programmeItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No items with duration. Add durations to WBS items to see them here.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {programmeItems.map((item: any) => {
              const barPosition = getBarPosition(item);

              return (
                <div key={item.id} className="flex hover:bg-gray-50">
                  {/* Activity name */}
                  <div
                    className="w-80 flex-shrink-0 px-4 py-3 border-r border-gray-200 flex items-center gap-2"
                    style={{ paddingLeft: `${item.level * 16 + 16}px` }}
                  >
                    {item.level === 1 && <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div>
                      <span className={`text-sm ${item.level === 1 ? 'font-semibold' : ''}`}>
                        {item.code} - {item.name}
                      </span>
                      <div className="text-xs text-gray-400">
                        {item.duration_days}d | {formatShortDate(item.start_date)} - {formatShortDate(item.end_date)}
                      </div>
                    </div>
                  </div>

                  {/* Gantt bar area */}
                  <div className="flex-1 relative py-3">
                    {barPosition && (
                      <div
                        className={`absolute h-6 rounded ${getBarColor(item.level)} opacity-90`}
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
        <div className="grid grid-cols-4 gap-8">
          <div>
            <p className="text-sm text-gray-500">Total Activities</p>
            <p className="text-2xl font-bold">{programmeItems.length}</p>
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
    </div>
  );
}
