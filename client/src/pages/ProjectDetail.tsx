import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { projectsApi, dashboardApi } from '../services/api';
import { formatCurrency, formatPercent, formatDate, getStatusColor, getVarianceColor } from '../utils/format';
import {
  ArrowLeft,
  Copy,
  PlayCircle,
  Calendar,
  DollarSign,
  FileText,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Settings,
  ChevronRight
} from 'lucide-react';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', 'project', id],
    queryFn: () => dashboardApi.project(id!),
    enabled: !!project && project.status !== 'tender',
  });

  const convertMutation = useMutation({
    mutationFn: () => projectsApi.convertToProject(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  if (projectLoading) {
    return <div className="p-8 text-center text-gray-500">Loading project...</div>;
  }

  if (!project) {
    return <div className="p-8 text-center text-gray-500">Project not found</div>;
  }

  const isTender = project.status === 'tender';

  const navLinks = [
    { path: 'wbs', icon: FileText, label: 'WBS / Estimate' },
    { path: 'programme', icon: Calendar, label: 'Programme' },
    { path: 'costs', icon: DollarSign, label: 'Costs' },
    { path: 'claims', icon: BarChart3, label: 'Claims' },
    { path: 'cashflow', icon: TrendingUp, label: 'Cashflow' },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <Link
            to="/projects"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{project.code}</h1>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
            </div>
            <p className="text-gray-600">{project.name}</p>
            {project.client && (
              <p className="text-sm text-gray-500">Client: {project.client}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isTender && (
            <button
              onClick={() => convertMutation.mutate()}
              disabled={convertMutation.isPending}
              className="btn btn-primary flex items-center gap-2"
            >
              <PlayCircle className="w-4 h-4" />
              Convert to Project
            </button>
          )}
          <button className="btn btn-secondary flex items-center gap-2">
            <Copy className="w-4 h-4" />
            Clone
          </button>
          <button className="btn btn-secondary flex items-center gap-2">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {navLinks.map((link) => (
          <Link
            key={link.path}
            to={`/projects/${id}/${link.path}`}
            className="card p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors group"
          >
            <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-primary-100 transition-colors">
              <link.icon className="w-5 h-5 text-gray-600 group-hover:text-primary-600" />
            </div>
            <span className="font-medium text-gray-700 group-hover:text-gray-900">
              {link.label}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
          </Link>
        ))}
      </div>

      {/* Dashboard for Active Projects */}
      {!isTender && dashboard && (
        <div className="space-y-6">
          {/* Alert Banner */}
          {dashboard.alerts && dashboard.alerts.length > 0 && (
            <div className="card p-4 bg-yellow-50 border-yellow-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800">Attention Required</h3>
                  <ul className="mt-2 space-y-1">
                    {dashboard.alerts.map((alert: any, idx: number) => (
                      <li key={idx} className="text-sm text-yellow-700">{alert.message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Programme */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-700">Programme</h3>
                <Calendar className="w-5 h-5 text-gray-400" />
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-500">Progress</span>
                    <span className="font-medium">{formatPercent(dashboard.programme.percent_complete)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full"
                      style={{ width: `${Math.min(100, dashboard.programme.percent_complete)}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {formatDate(dashboard.programme.start_date)} - {formatDate(dashboard.programme.end_date)}
                </div>
              </div>
            </div>

            {/* Cost */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-700">Cost</h3>
                <DollarSign className="w-5 h-5 text-gray-400" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Budget</span>
                  <span className="font-medium">{formatCurrency(dashboard.cost.budget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Forecast</span>
                  <span className="font-medium">{formatCurrency(dashboard.cost.forecast)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Variance</span>
                  <span className={`font-medium ${getVarianceColor(dashboard.cost.variance)}`}>
                    {formatCurrency(dashboard.cost.variance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Revenue */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-700">Revenue</h3>
                <BarChart3 className="w-5 h-5 text-gray-400" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Contract</span>
                  <span className="font-medium">{formatCurrency(dashboard.revenue.revised_contract)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Claimed</span>
                  <span className="font-medium">{formatCurrency(dashboard.revenue.claimed)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Outstanding</span>
                  <span className="font-medium text-yellow-600">
                    {formatCurrency(dashboard.revenue.outstanding)}
                  </span>
                </div>
              </div>
            </div>

            {/* Margin */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-700">Margin</h3>
                <TrendingUp className="w-5 h-5 text-gray-400" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Budget</span>
                  <span className="font-medium">{formatPercent(dashboard.margin.budget_percent)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Forecast</span>
                  <span className={`font-medium ${dashboard.margin.forecast_percent < 3 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatPercent(dashboard.margin.forecast_percent)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Forecast Value</span>
                  <span className="font-medium">{formatCurrency(dashboard.margin.forecast)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Earned Value */}
          <div className="card p-6">
            <h3 className="font-medium text-gray-700 mb-4">Earned Value Analysis</h3>
            <div className="grid grid-cols-4 gap-8">
              <div>
                <p className="text-sm text-gray-500">% Complete</p>
                <p className="text-2xl font-bold">{formatPercent(dashboard.progress.percent_complete)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Earned Value</p>
                <p className="text-2xl font-bold">{formatCurrency(dashboard.progress.earned_value)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">CPI (Cost Performance)</p>
                <p className={`text-2xl font-bold ${dashboard.progress.cpi < 1 ? 'text-red-600' : 'text-green-600'}`}>
                  {dashboard.progress.cpi.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">SPI (Schedule Performance)</p>
                <p className={`text-2xl font-bold ${dashboard.progress.spi < 1 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {dashboard.progress.spi.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Project Settings */}
      <div className="mt-8">
        <h3 className="font-medium text-gray-700 mb-4">Project Settings</h3>
        <div className="card p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">Retention</p>
              <p className="font-medium">{project.retention_percent}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Payment Terms</p>
              <p className="font-medium">{project.payment_terms_days} days</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Contingency</p>
              <p className="font-medium">{project.contingency_percent}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Overhead</p>
              <p className="font-medium">{project.overhead_percent}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Target Margin</p>
              <p className="font-medium">{project.margin_percent}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Start Date</p>
              <p className="font-medium">{project.start_date ? formatDate(project.start_date) : '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">End Date</p>
              <p className="font-medium">{project.end_date ? formatDate(project.end_date) : '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Contract Value</p>
              <p className="font-medium">{project.contract_value > 0 ? formatCurrency(project.contract_value) : '-'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
