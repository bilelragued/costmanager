import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi, settingsApi } from '../services/api';
import { formatCurrency, formatPercent, getStatusColor } from '../utils/format';
import {
  Building2,
  TrendingUp,
  AlertTriangle,
  FileText,
  Clock,
  DollarSign,
  BarChart3,
  Play
} from 'lucide-react';

export default function Dashboard() {
  const { data: dashboard, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'company'],
    queryFn: dashboardApi.company,
  });

  const seedDemo = async () => {
    await settingsApi.seedDemo();
    refetch();
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="p-8">
        <div className="card p-8 text-center">
          <h2 className="text-xl font-semibold mb-4">Welcome to ConstructFlow</h2>
          <p className="text-gray-600 mb-6">
            Get started by loading demo data or creating your first project.
          </p>
          <div className="flex gap-4 justify-center">
            <button onClick={seedDemo} className="btn btn-primary flex items-center gap-2">
              <Play className="w-4 h-4" />
              Load Demo Data
            </button>
            <Link to="/projects" className="btn btn-secondary">
              Go to Projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Company Dashboard</h1>
        <p className="text-gray-500">Overview of all projects and company health</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Projects</p>
              <p className="text-2xl font-bold">{dashboard.summary.active_projects}</p>
              <p className="text-sm text-gray-600">
                {formatCurrency(dashboard.summary.active_contract_value)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <FileText className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tenders in Progress</p>
              <p className="text-2xl font-bold">{dashboard.summary.tenders_in_progress}</p>
              <p className="text-sm text-gray-600">
                {formatCurrency(dashboard.summary.tender_pipeline_value)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Outstanding Claims</p>
              <p className="text-2xl font-bold">
                {formatCurrency(dashboard.summary.outstanding_claims)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Bank Facility</p>
              <p className="text-2xl font-bold">
                {formatCurrency(dashboard.summary.bank_facility)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Projects */}
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-gray-500" />
              Active Projects
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {dashboard.active_projects.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No active projects</div>
            ) : (
              dashboard.active_projects.map((project: any) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{project.code}</p>
                    <p className="text-sm text-gray-500">{project.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(project.contract_value)}</p>
                    <p className={`text-sm ${project.margin_percent >= 5 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {formatPercent(project.margin_percent)} margin
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Tender Pipeline */}
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-500" />
              Tender Pipeline
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {dashboard.tender_pipeline.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No tenders in progress</div>
            ) : (
              dashboard.tender_pipeline.map((tender: any) => (
                <Link
                  key={tender.id}
                  to={`/projects/${tender.id}`}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{tender.code}</p>
                    <p className="text-sm text-gray-500">{tender.name}</p>
                    <p className="text-xs text-gray-400">{tender.client}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(tender.tender_value)}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor('tender')}`}>
                      Tender
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Outstanding Claims */}
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-500" />
              Outstanding Claims
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {dashboard.outstanding_claims.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No outstanding claims</div>
            ) : (
              dashboard.outstanding_claims.map((claim: any, idx: number) => (
                <div key={idx} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {claim.project_code} - Claim #{claim.claim_number}
                    </p>
                    <p className="text-sm text-gray-500">{claim.project_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(claim.amount)}</p>
                    <p className={`text-sm ${claim.days_outstanding > 30 ? 'text-red-600' : 'text-gray-500'}`}>
                      {claim.days_outstanding} days
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Attention Required */}
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Attention Required
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {dashboard.attention_required.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No issues requiring attention</div>
            ) : (
              dashboard.attention_required.map((item: any, idx: number) => (
                <Link
                  key={idx}
                  to={`/projects/${item.project_id}`}
                  className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full ${
                    item.severity === 'high' ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.project_code}</p>
                    <p className="text-sm text-gray-500">{item.issue}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
