import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { cashflowApi, projectsApi } from '../services/api';
import { formatCurrency, formatMonth, getVarianceColor } from '../utils/format';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

export default function Cashflow() {
  const { id: projectId } = useParams<{ id: string }>();
  const [months, setMonths] = useState(12);

  const isCompanyView = !projectId;

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !isCompanyView,
  });

  const { data: projectCashflow, isLoading: projectLoading } = useQuery({
    queryKey: ['cashflow', 'project', projectId, months],
    queryFn: () => cashflowApi.project(projectId!, months),
    enabled: !isCompanyView,
  });

  const { data: companyCashflow, isLoading: companyLoading } = useQuery({
    queryKey: ['cashflow', 'company', months],
    queryFn: () => cashflowApi.company(months),
    enabled: isCompanyView,
  });

  const cashflow = isCompanyView ? companyCashflow : projectCashflow;
  const isLoading = isCompanyView ? companyLoading : projectLoading;

  // Prepare chart data
  const chartData = cashflow?.forecast?.map((month: any) => ({
    month: formatMonth(month.month),
    inflows: month.inflows.total,
    outflows: -month.outflows.total,
    net: month.net,
    cumulative: month.cumulative,
  })) || [];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {!isCompanyView && (
            <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isCompanyView ? 'Company Cashflow' : 'Project Cashflow'}
            </h1>
            <p className="text-gray-500">
              {isCompanyView ? 'Aggregate cashflow across all active projects' : project?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Forecast period:</span>
          <select
            value={months}
            onChange={(e) => setMonths(parseInt(e.target.value))}
            className="input w-32"
          >
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
            <option value={18}>18 months</option>
            <option value={24}>24 months</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-500 py-12">Loading cashflow forecast...</div>
      ) : cashflow ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-6">
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Inflows</p>
                  <p className="text-xl font-bold">{formatCurrency(cashflow.summary.total_inflows)}</p>
                </div>
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 rounded-lg">
                  <TrendingDown className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Outflows</p>
                  <p className="text-xl font-bold">{formatCurrency(cashflow.summary.total_outflows)}</p>
                </div>
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Net Cashflow</p>
                  <p className={`text-xl font-bold ${getVarianceColor(cashflow.summary.net_cashflow)}`}>
                    {formatCurrency(cashflow.summary.net_cashflow)}
                  </p>
                </div>
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${cashflow.summary.peak_negative < 0 ? 'bg-yellow-100' : 'bg-green-100'}`}>
                  <AlertTriangle className={`w-6 h-6 ${cashflow.summary.peak_negative < 0 ? 'text-yellow-600' : 'text-green-600'}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Peak Negative</p>
                  <p className={`text-xl font-bold ${cashflow.summary.peak_negative < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(cashflow.summary.peak_negative)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Cumulative Chart */}
          <div className="card p-6">
            <h3 className="font-medium mb-4">Cumulative Cashflow</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#3b82f6"
                    fill="#93c5fd"
                    fillOpacity={0.6}
                    name="Cumulative"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Breakdown Chart */}
          <div className="card p-6">
            <h3 className="font-medium mb-4">Monthly Inflows & Outflows</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(Math.abs(value))}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend />
                  <Bar dataKey="inflows" fill="#22c55e" name="Inflows" />
                  <Bar dataKey="outflows" fill="#ef4444" name="Outflows" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-medium">Monthly Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3 text-right">Claims</th>
                    <th className="px-4 py-3 text-right">Labour</th>
                    <th className="px-4 py-3 text-right">Plant</th>
                    <th className="px-4 py-3 text-right">Materials</th>
                    <th className="px-4 py-3 text-right">Subcon</th>
                    <th className="px-4 py-3 text-right">Other</th>
                    <th className="px-4 py-3 text-right">Net</th>
                    <th className="px-4 py-3 text-right">Cumulative</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cashflow.forecast.map((month: any) => (
                    <tr key={month.month} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{formatMonth(month.month)}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-600">
                        {month.inflows.claims > 0 ? formatCurrency(month.inflows.claims) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-red-600">
                        {month.outflows.labour > 0 ? `-${formatCurrency(month.outflows.labour)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-red-600">
                        {month.outflows.plant > 0 ? `-${formatCurrency(month.outflows.plant)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-red-600">
                        {month.outflows.materials > 0 ? `-${formatCurrency(month.outflows.materials)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-red-600">
                        {month.outflows.subcontractors > 0 ? `-${formatCurrency(month.outflows.subcontractors)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-red-600">
                        {month.outflows.other > 0 ? `-${formatCurrency(month.outflows.other)}` : '-'}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-medium ${getVarianceColor(month.net)}`}>
                        {formatCurrency(month.net)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${getVarianceColor(month.cumulative)}`}>
                        {formatCurrency(month.cumulative)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-12 text-center">
          <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Cashflow Data</h3>
          <p className="text-gray-500">
            Add WBS items with programme dates to generate a cashflow forecast.
          </p>
        </div>
      )}
    </div>
  );
}
