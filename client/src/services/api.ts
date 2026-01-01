const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Projects
export const projectsApi = {
  list: (status?: string) => request<any[]>(`/projects${status ? `?status=${status}` : ''}`),
  get: (id: string) => request<any>(`/projects/${id}`),
  create: (data: any) => request<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/projects/${id}`, { method: 'DELETE' }),
  convertToProject: (id: string) => request<any>(`/projects/${id}/convert-to-project`, { method: 'POST' }),
  clone: (id: string, data: any) => request<any>(`/projects/${id}/clone`, { method: 'POST', body: JSON.stringify(data) }),
};

// Resources
export const resourcesApi = {
  plant: {
    list: () => request<any[]>('/resources/plant'),
    create: (data: any) => request<any>('/resources/plant', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/resources/plant/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/resources/plant/${id}`, { method: 'DELETE' }),
  },
  labour: {
    list: () => request<any[]>('/resources/labour'),
    create: (data: any) => request<any>('/resources/labour', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/resources/labour/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/resources/labour/${id}`, { method: 'DELETE' }),
  },
  materials: {
    list: () => request<any[]>('/resources/materials'),
    create: (data: any) => request<any>('/resources/materials', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/resources/materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/resources/materials/${id}`, { method: 'DELETE' }),
  },
  subcontractors: {
    list: () => request<any[]>('/resources/subcontractors'),
    create: (data: any) => request<any>('/resources/subcontractors', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/resources/subcontractors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/resources/subcontractors/${id}`, { method: 'DELETE' }),
  },
};

// WBS
export const wbsApi = {
  listByProject: (projectId: string) => request<any[]>(`/wbs/project/${projectId}`),
  get: (id: string) => request<any>(`/wbs/${id}`),
  create: (data: any) => request<any>('/wbs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/wbs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/wbs/${id}`, { method: 'DELETE' }),
  recalculateProgramme: (projectId: string, startDate: string) =>
    request<any[]>(`/wbs/project/${projectId}/recalculate-programme`, { method: 'POST', body: JSON.stringify({ start_date: startDate }) }),
  // Resource assignments
  addPlant: (wbsId: string, data: any) => request<any>(`/wbs/${wbsId}/plant`, { method: 'POST', body: JSON.stringify(data) }),
  updatePlant: (id: string, data: any) => request<any>(`/wbs/plant-assignment/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlant: (id: string) => request<any>(`/wbs/plant-assignment/${id}`, { method: 'DELETE' }),
  addLabour: (wbsId: string, data: any) => request<any>(`/wbs/${wbsId}/labour`, { method: 'POST', body: JSON.stringify(data) }),
  updateLabour: (id: string, data: any) => request<any>(`/wbs/labour-assignment/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLabour: (id: string) => request<any>(`/wbs/labour-assignment/${id}`, { method: 'DELETE' }),
  addMaterial: (wbsId: string, data: any) => request<any>(`/wbs/${wbsId}/material`, { method: 'POST', body: JSON.stringify(data) }),
  updateMaterial: (id: string, data: any) => request<any>(`/wbs/material-assignment/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMaterial: (id: string) => request<any>(`/wbs/material-assignment/${id}`, { method: 'DELETE' }),
  addSubcontractor: (wbsId: string, data: any) => request<any>(`/wbs/${wbsId}/subcontractor`, { method: 'POST', body: JSON.stringify(data) }),
  updateSubcontractor: (id: string, data: any) => request<any>(`/wbs/subcontractor-assignment/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSubcontractor: (id: string) => request<any>(`/wbs/subcontractor-assignment/${id}`, { method: 'DELETE' }),
};

// Costs
export const costsApi = {
  dailyLogs: {
    list: (projectId: string) => request<any[]>(`/costs/daily-logs/${projectId}`),
    get: (id: string) => request<any>(`/costs/daily-log/${id}`),
    create: (data: any) => request<any>('/costs/daily-logs', { method: 'POST', body: JSON.stringify(data) }),
    addPlant: (logId: string, data: any) => request<any>(`/costs/daily-log/${logId}/plant`, { method: 'POST', body: JSON.stringify(data) }),
    addLabour: (logId: string, data: any) => request<any>(`/costs/daily-log/${logId}/labour`, { method: 'POST', body: JSON.stringify(data) }),
    addMaterial: (logId: string, data: any) => request<any>(`/costs/daily-log/${logId}/material`, { method: 'POST', body: JSON.stringify(data) }),
    addQuantity: (logId: string, data: any) => request<any>(`/costs/daily-log/${logId}/quantity`, { method: 'POST', body: JSON.stringify(data) }),
  },
  entries: {
    list: (projectId: string) => request<any[]>(`/costs/entries/${projectId}`),
    create: (data: any) => request<any>('/costs/entries', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/costs/entries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  variations: {
    list: (projectId: string) => request<any[]>(`/costs/variations/${projectId}`),
    create: (data: any) => request<any>('/costs/variations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/costs/variations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  summary: (projectId: string) => request<any>(`/costs/summary/${projectId}`),
  wbsBreakdown: (projectId: string) => request<any[]>(`/costs/wbs-breakdown/${projectId}`),
};

// Claims
export const claimsApi = {
  list: (projectId: string) => request<any[]>(`/claims/project/${projectId}`),
  get: (id: string) => request<any>(`/claims/${id}`),
  create: (data: any) => request<any>('/claims', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/claims/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/claims/${id}`, { method: 'DELETE' }),
  updateLineItem: (id: string, data: any) => request<any>(`/claims/line-item/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  summary: (projectId: string) => request<any>(`/claims/summary/${projectId}`),
};

// Cashflow
export const cashflowApi = {
  project: (projectId: string, months?: number) =>
    request<any>(`/cashflow/project/${projectId}${months ? `?months=${months}` : ''}`),
  company: (months?: number) => request<any>(`/cashflow/company${months ? `?months=${months}` : ''}`),
  scenario: (data: any) => request<any>('/cashflow/scenario', { method: 'POST', body: JSON.stringify(data) }),
};

// Dashboard
export const dashboardApi = {
  project: (projectId: string) => request<any>(`/dashboard/project/${projectId}`),
  company: () => request<any>('/dashboard/company'),
};

// Settings
export const settingsApi = {
  get: () => request<any>('/settings'),
  update: (data: any) => request<any>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  seedDemo: () => request<any>('/settings/seed-demo', { method: 'POST' }),
};

// Mappings
export const mappingsApi = {
  // Programme Tasks
  programmeTasks: {
    list: (projectId: string) => request<any[]>(`/mappings/programme-tasks/project/${projectId}`),
    get: (id: string) => request<any>(`/mappings/programme-tasks/${id}`),
    create: (data: any) => request<any>('/mappings/programme-tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/mappings/programme-tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/mappings/programme-tasks/${id}`, { method: 'DELETE' }),
    recalculate: (projectId: string, startDate: string) =>
      request<any[]>(`/mappings/programme-tasks/project/${projectId}/recalculate`, { method: 'POST', body: JSON.stringify({ start_date: startDate }) }),
  },

  // Programme-WBS Mappings
  programmeWbs: {
    listByProject: (projectId: string) => request<any[]>(`/mappings/programme-wbs/project/${projectId}`),
    listByTask: (taskId: string) => request<any[]>(`/mappings/programme-wbs/task/${taskId}`),
    listByWbs: (wbsId: string) => request<any[]>(`/mappings/programme-wbs/wbs/${wbsId}`),
    create: (data: any) => request<any>('/mappings/programme-wbs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/mappings/programme-wbs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/mappings/programme-wbs/${id}`, { method: 'DELETE' }),
    bulkCreate: (projectId: string, mappings: any[]) =>
      request<any[]>('/mappings/programme-wbs/bulk', { method: 'POST', body: JSON.stringify({ project_id: projectId, mappings }) }),
  },

  // Resource-Programme Mappings
  resourceProgramme: {
    listByProject: (projectId: string) => request<any[]>(`/mappings/resource-programme/project/${projectId}`),
    listByTask: (taskId: string) => request<any[]>(`/mappings/resource-programme/task/${taskId}`),
    create: (data: any) => request<any>('/mappings/resource-programme', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/mappings/resource-programme/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/mappings/resource-programme/${id}`, { method: 'DELETE' }),
  },

  // Allocation Rules
  allocationRules: {
    list: (projectId: string) => request<any[]>(`/mappings/allocation-rules/project/${projectId}`),
    get: (id: string) => request<any>(`/mappings/allocation-rules/${id}`),
    create: (data: any) => request<any>('/mappings/allocation-rules', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/mappings/allocation-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/mappings/allocation-rules/${id}`, { method: 'DELETE' }),
    addTarget: (ruleId: string, data: any) =>
      request<any>(`/mappings/allocation-rules/${ruleId}/targets`, { method: 'POST', body: JSON.stringify(data) }),
    updateTarget: (id: string, data: any) =>
      request<any>(`/mappings/allocation-rule-targets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTarget: (id: string) => request<any>(`/mappings/allocation-rule-targets/${id}`, { method: 'DELETE' }),
  },

  // Actual Cost Allocations
  actualAllocations: {
    listByProject: (projectId: string) => request<any[]>(`/mappings/actual-allocations/project/${projectId}`),
    listBySource: (sourceType: string, sourceId: string) =>
      request<any[]>(`/mappings/actual-allocations/source/${sourceType}/${sourceId}`),
    create: (data: any) => request<any>('/mappings/actual-allocations', { method: 'POST', body: JSON.stringify(data) }),
    bulkCreate: (allocations: any[]) =>
      request<any[]>('/mappings/actual-allocations/bulk', { method: 'POST', body: JSON.stringify({ allocations }) }),
    update: (id: string, data: any) => request<any>(`/mappings/actual-allocations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/mappings/actual-allocations/${id}`, { method: 'DELETE' }),
    deleteBySource: (sourceType: string, sourceId: string) =>
      request<any>(`/mappings/actual-allocations/source/${sourceType}/${sourceId}`, { method: 'DELETE' }),
  },

  // Mapping Templates
  templates: {
    list: (projectId?: string) => request<any[]>(`/mappings/templates${projectId ? `?project_id=${projectId}` : ''}`),
    get: (id: string) => request<any>(`/mappings/templates/${id}`),
    create: (data: any) => request<any>('/mappings/templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/mappings/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/mappings/templates/${id}`, { method: 'DELETE' }),
  },

  // Validation & Matrix
  validation: (projectId: string) => request<any>(`/mappings/validation/project/${projectId}`),
  matrix: (projectId: string) => request<any>(`/mappings/matrix/project/${projectId}`),

  // Programme-Revenue Mappings
  programmeRevenue: {
    listByProject: (projectId: string) => request<any[]>(`/mappings/programme-revenue/project/${projectId}`),
    listByTask: (taskId: string) => request<any[]>(`/mappings/programme-revenue/task/${taskId}`),
    listByRevenue: (revenueId: string) => request<any[]>(`/mappings/programme-revenue/revenue/${revenueId}`),
    create: (data: any) => request<any>('/mappings/programme-revenue', { method: 'POST', body: JSON.stringify(data) }),
    bulkCreate: (data: any) => request<any>('/mappings/programme-revenue/bulk', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/mappings/programme-revenue/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/mappings/programme-revenue/${id}`, { method: 'DELETE' }),
  },

  // WBS-Revenue Mappings
  wbsRevenue: {
    listByProject: (projectId: string) => request<any[]>(`/mappings/wbs-revenue/project/${projectId}`),
    listByWbs: (wbsId: string) => request<any[]>(`/mappings/wbs-revenue/wbs/${wbsId}`),
    listByRevenue: (revenueId: string) => request<any[]>(`/mappings/wbs-revenue/revenue/${revenueId}`),
    create: (data: any) => request<any>('/mappings/wbs-revenue', { method: 'POST', body: JSON.stringify(data) }),
    bulkCreate: (data: any) => request<any>('/mappings/wbs-revenue/bulk', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/mappings/wbs-revenue/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/mappings/wbs-revenue/${id}`, { method: 'DELETE' }),
  },
};

// Revenue Items API
export const revenueApi = {
  list: (projectId: string) => request<any[]>(`/revenue/project/${projectId}`),
  get: (id: string) => request<any>(`/revenue/${id}`),
  create: (data: any) => request<any>('/revenue', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/revenue/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/revenue/${id}`, { method: 'DELETE' }),
  importFromWbs: (projectId: string) => request<any>(`/revenue/import-from-wbs/${projectId}`, { method: 'POST' }),
};

// AI Cost Assignment API
export const aiApi = {
  suggestAssignment: (data: {
    project_id: string;
    description: string;
    vendor_name?: string;
    amount: number;
    transaction_date: string;
    cost_type?: string;
  }) => request<{ suggestions: any[] }>('/ai/suggest-assignment', { method: 'POST', body: JSON.stringify(data) }),

  acceptSuggestion: (suggestionId: string, modifications?: any) =>
    request<any>(`/ai/suggestion/${suggestionId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ modifications: modifications || null })
    }),

  rejectSuggestion: (suggestionId: string, reason?: string) =>
    request<any>(`/ai/suggestion/${suggestionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || null })
    }),

  batchAssign: (projectId: string, options?: { source_type?: string; source_ids?: string[] }) =>
    request<{ processed: number; suggestions: any[] }>(
      `/ai/batch-assign/${projectId}`,
      { method: 'POST', body: JSON.stringify(options || {}) }
    ),

  getPendingSuggestions: (projectId: string, status = 'pending') =>
    request<any[]>(`/ai/suggestions/${projectId}?status=${status}`),

  getVendorPatterns: (projectId: string) =>
    request<any[]>(`/ai/vendor-patterns/${projectId}`),

  train: (projectId: string) =>
    request<any>(`/ai/train/${projectId}`, { method: 'POST' }),

  getStatus: () => request<{ enabled: boolean; message: string }>('/ai/status'),
};
