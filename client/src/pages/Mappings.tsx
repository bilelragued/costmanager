import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { mappingsApi, projectsApi, wbsApi, revenueApi } from '../services/api';
import { formatCurrency } from '../utils/format';
import {
  ArrowLeft, Link as LinkIcon, AlertTriangle, CheckCircle,
  Trash2, X, Percent, DollarSign, Search,
  ChevronRight, ChevronDown
} from 'lucide-react';
import type { ProgrammeTask, WBSItem } from '../types';

interface RevenueItem {
  id: string;
  code: string;
  name: string;
  parent_id?: string;
  level: number;
  contract_value: number;
  unit?: string;
}

interface Mapping {
  id: string;
  allocation_percent: number;
  allocation_type: string;
}

type LinkType = 'cost-programme' | 'programme-deliverable' | 'cost-deliverable';

export default function Mappings() {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Selection state for each panel
  const [selectedCost, setSelectedCost] = useState<string | null>(null);
  const [selectedProgramme, setSelectedProgramme] = useState<string | null>(null);
  const [selectedDeliverable, setSelectedDeliverable] = useState<string | null>(null);

  // Search state
  const [searchCost, setSearchCost] = useState('');
  const [searchProgramme, setSearchProgramme] = useState('');
  const [searchDeliverable, setSearchDeliverable] = useState('');

  // Expanded items
  const [expandedCost, setExpandedCost] = useState<Set<string>>(new Set());
  const [expandedProgramme, setExpandedProgramme] = useState<Set<string>>(new Set());
  const [expandedDeliverable, setExpandedDeliverable] = useState<Set<string>>(new Set());

  // Modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkType, setLinkType] = useState<LinkType | null>(null);

  // Queries
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
  });

  const { data: costItems = [] } = useQuery({
    queryKey: ['wbs', projectId],
    queryFn: () => wbsApi.listByProject(projectId!),
  });

  const { data: programmeTasks = [] } = useQuery({
    queryKey: ['programme-tasks', projectId],
    queryFn: () => mappingsApi.programmeTasks.list(projectId!),
  });

  const { data: deliverables = [] } = useQuery({
    queryKey: ['revenue-items', projectId],
    queryFn: () => revenueApi.list(projectId!),
  });

  const { data: costProgrammeMappings = [] } = useQuery({
    queryKey: ['programme-wbs-mappings', projectId],
    queryFn: () => mappingsApi.programmeWbs.listByProject(projectId!),
  });

  const { data: programmeDeliverableMappings = [] } = useQuery({
    queryKey: ['programme-revenue-mappings', projectId],
    queryFn: () => mappingsApi.programmeRevenue.listByProject(projectId!),
  });

  const { data: costDeliverableMappings = [] } = useQuery({
    queryKey: ['wbs-revenue-mappings', projectId],
    queryFn: () => mappingsApi.wbsRevenue.listByProject(projectId!),
  });

  const { data: validation } = useQuery({
    queryKey: ['mapping-validation', projectId],
    queryFn: () => mappingsApi.validation(projectId!),
  });

  // Mutations
  const createCostProgrammeMutation = useMutation({
    mutationFn: (data: any) => mappingsApi.programmeWbs.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programme-wbs-mappings', projectId] });
      queryClient.invalidateQueries({ queryKey: ['mapping-validation', projectId] });
      setShowLinkModal(false);
    },
  });

  const createProgrammeDeliverableMutation = useMutation({
    mutationFn: (data: any) => mappingsApi.programmeRevenue.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programme-revenue-mappings', projectId] });
      queryClient.invalidateQueries({ queryKey: ['mapping-validation', projectId] });
      setShowLinkModal(false);
    },
  });

  const createCostDeliverableMutation = useMutation({
    mutationFn: (data: any) => mappingsApi.wbsRevenue.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wbs-revenue-mappings', projectId] });
      queryClient.invalidateQueries({ queryKey: ['mapping-validation', projectId] });
      setShowLinkModal(false);
    },
  });

  const deleteCostProgrammeMutation = useMutation({
    mutationFn: (id: string) => mappingsApi.programmeWbs.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programme-wbs-mappings', projectId] });
      queryClient.invalidateQueries({ queryKey: ['mapping-validation', projectId] });
    },
  });

  const deleteProgrammeDeliverableMutation = useMutation({
    mutationFn: (id: string) => mappingsApi.programmeRevenue.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programme-revenue-mappings', projectId] });
      queryClient.invalidateQueries({ queryKey: ['mapping-validation', projectId] });
    },
  });

  const deleteCostDeliverableMutation = useMutation({
    mutationFn: (id: string) => mappingsApi.wbsRevenue.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wbs-revenue-mappings', projectId] });
      queryClient.invalidateQueries({ queryKey: ['mapping-validation', projectId] });
    },
  });

  // Build mapping lookups
  const costProgrammeLookup = useMemo(() => {
    const lookup: Record<string, Mapping[]> = {};
    costProgrammeMappings.forEach((m: any) => {
      if (!lookup[m.wbs_item_id]) lookup[m.wbs_item_id] = [];
      if (!lookup[m.programme_task_id]) lookup[m.programme_task_id] = [];
      lookup[m.wbs_item_id].push(m);
      lookup[m.programme_task_id].push(m);
    });
    return lookup;
  }, [costProgrammeMappings]);

  const programmeDeliverableLookup = useMemo(() => {
    const lookup: Record<string, Mapping[]> = {};
    programmeDeliverableMappings.forEach((m: any) => {
      if (!lookup[m.programme_task_id]) lookup[m.programme_task_id] = [];
      if (!lookup[m.revenue_item_id]) lookup[m.revenue_item_id] = [];
      lookup[m.programme_task_id].push(m);
      lookup[m.revenue_item_id].push(m);
    });
    return lookup;
  }, [programmeDeliverableMappings]);

  const costDeliverableLookup = useMemo(() => {
    const lookup: Record<string, Mapping[]> = {};
    costDeliverableMappings.forEach((m: any) => {
      if (!lookup[m.wbs_item_id]) lookup[m.wbs_item_id] = [];
      if (!lookup[m.revenue_item_id]) lookup[m.revenue_item_id] = [];
      lookup[m.wbs_item_id].push(m);
      lookup[m.revenue_item_id].push(m);
    });
    return lookup;
  }, [costDeliverableMappings]);

  // Compute highlighted items based on selection
  const highlightedItems = useMemo(() => {
    const costIds = new Set<string>();
    const programmeIds = new Set<string>();
    const deliverableIds = new Set<string>();

    if (selectedCost) {
      // Find programme tasks linked to this cost item
      costProgrammeMappings
        .filter((m: any) => m.wbs_item_id === selectedCost)
        .forEach((m: any) => programmeIds.add(m.programme_task_id));
      // Find deliverables linked to this cost item
      costDeliverableMappings
        .filter((m: any) => m.wbs_item_id === selectedCost)
        .forEach((m: any) => deliverableIds.add(m.revenue_item_id));
    }

    if (selectedProgramme) {
      // Find cost items linked to this programme task
      costProgrammeMappings
        .filter((m: any) => m.programme_task_id === selectedProgramme)
        .forEach((m: any) => costIds.add(m.wbs_item_id));
      // Find deliverables linked to this programme task
      programmeDeliverableMappings
        .filter((m: any) => m.programme_task_id === selectedProgramme)
        .forEach((m: any) => deliverableIds.add(m.revenue_item_id));
    }

    if (selectedDeliverable) {
      // Find cost items linked to this deliverable
      costDeliverableMappings
        .filter((m: any) => m.revenue_item_id === selectedDeliverable)
        .forEach((m: any) => costIds.add(m.wbs_item_id));
      // Find programme tasks linked to this deliverable
      programmeDeliverableMappings
        .filter((m: any) => m.revenue_item_id === selectedDeliverable)
        .forEach((m: any) => programmeIds.add(m.programme_task_id));
    }

    return { costIds, programmeIds, deliverableIds };
  }, [selectedCost, selectedProgramme, selectedDeliverable, costProgrammeMappings, programmeDeliverableMappings, costDeliverableMappings]);

  // Get link counts for items
  const getCostLinkCount = (id: string) => {
    return (costProgrammeLookup[id]?.length || 0) + (costDeliverableLookup[id]?.length || 0);
  };

  const getProgrammeLinkCount = (id: string) => {
    return (costProgrammeLookup[id]?.length || 0) + (programmeDeliverableLookup[id]?.length || 0);
  };

  const getDeliverableLinkCount = (id: string) => {
    return (programmeDeliverableLookup[id]?.length || 0) + (costDeliverableLookup[id]?.length || 0);
  };

  // Check if items are mapped
  const isCostMapped = (id: string) => getCostLinkCount(id) > 0;
  const isProgrammeMapped = (id: string) => getProgrammeLinkCount(id) > 0;
  const isDeliverableMapped = (id: string) => getDeliverableLinkCount(id) > 0;

  // Handle link creation
  const handleCreateLink = (type: LinkType) => {
    setLinkType(type);
    setShowLinkModal(true);
  };

  const handleSaveLink = (allocationType: string, allocationPercent: number, notes: string) => {
    const baseData = {
      project_id: projectId,
      allocation_type: allocationType,
      allocation_percent: allocationPercent,
      notes,
    };

    if (linkType === 'cost-programme' && selectedCost && selectedProgramme) {
      createCostProgrammeMutation.mutate({
        ...baseData,
        wbs_item_id: selectedCost,
        programme_task_id: selectedProgramme,
      });
    } else if (linkType === 'programme-deliverable' && selectedProgramme && selectedDeliverable) {
      createProgrammeDeliverableMutation.mutate({
        ...baseData,
        programme_task_id: selectedProgramme,
        revenue_item_id: selectedDeliverable,
      });
    } else if (linkType === 'cost-deliverable' && selectedCost && selectedDeliverable) {
      createCostDeliverableMutation.mutate({
        ...baseData,
        wbs_item_id: selectedCost,
        revenue_item_id: selectedDeliverable,
      });
    }
  };

  // Get selected item names for display
  const selectedCostItem = costItems.find((c: WBSItem) => c.id === selectedCost);
  const selectedProgrammeTask = programmeTasks.find((p: ProgrammeTask) => p.id === selectedProgramme);
  const selectedDeliverableItem = deliverables.find((d: RevenueItem) => d.id === selectedDeliverable);

  // Check if link already exists
  const costProgrammeLinkExists = selectedCost && selectedProgramme &&
    costProgrammeMappings.some((m: any) => m.wbs_item_id === selectedCost && m.programme_task_id === selectedProgramme);
  const programmeDeliverableLinkExists = selectedProgramme && selectedDeliverable &&
    programmeDeliverableMappings.some((m: any) => m.programme_task_id === selectedProgramme && m.revenue_item_id === selectedDeliverable);
  const costDeliverableLinkExists = selectedCost && selectedDeliverable &&
    costDeliverableMappings.some((m: any) => m.wbs_item_id === selectedCost && m.revenue_item_id === selectedDeliverable);

  // Handle removing existing links
  const handleRemoveCostProgrammeLink = () => {
    const mapping = costProgrammeMappings.find((m: any) =>
      m.wbs_item_id === selectedCost && m.programme_task_id === selectedProgramme
    );
    if (mapping && confirm('Remove this link?')) {
      deleteCostProgrammeMutation.mutate(mapping.id);
    }
  };

  const handleRemoveProgrammeDeliverableLink = () => {
    const mapping = programmeDeliverableMappings.find((m: any) =>
      m.programme_task_id === selectedProgramme && m.revenue_item_id === selectedDeliverable
    );
    if (mapping && confirm('Remove this link?')) {
      deleteProgrammeDeliverableMutation.mutate(mapping.id);
    }
  };

  const handleRemoveCostDeliverableLink = () => {
    const mapping = costDeliverableMappings.find((m: any) =>
      m.wbs_item_id === selectedCost && m.revenue_item_id === selectedDeliverable
    );
    if (mapping && confirm('Remove this link?')) {
      deleteCostDeliverableMutation.mutate(mapping.id);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Project Mappings</h1>
            <p className="text-sm text-gray-500">{project?.name}</p>
          </div>
        </div>

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
            <span className="font-medium">{validation.summary.coverage_percent}% Coverage</span>
          </div>
        )}
      </div>

      {/* 3-Panel Layout */}
      <div className="flex-1 grid grid-cols-3 gap-4 p-4 bg-gray-100 overflow-hidden">
        {/* Cost Breakdown Panel */}
        <ItemPanel
          title="Cost Breakdown"
          items={costItems}
          selectedId={selectedCost}
          highlightedIds={highlightedItems.costIds}
          expandedIds={expandedCost}
          setExpandedIds={setExpandedCost}
          searchTerm={searchCost}
          setSearchTerm={setSearchCost}
          onSelect={setSelectedCost}
          getLinkCount={getCostLinkCount}
          isMapped={isCostMapped}
          emptyMessage="No cost items. Create items in Cost Breakdown page."
        />

        {/* Programme Panel */}
        <ItemPanel
          title="Programme"
          items={programmeTasks}
          selectedId={selectedProgramme}
          highlightedIds={highlightedItems.programmeIds}
          expandedIds={expandedProgramme}
          setExpandedIds={setExpandedProgramme}
          searchTerm={searchProgramme}
          setSearchTerm={setSearchProgramme}
          onSelect={setSelectedProgramme}
          getLinkCount={getProgrammeLinkCount}
          isMapped={isProgrammeMapped}
          emptyMessage="No programme tasks. Create tasks in Programme page."
        />

        {/* Deliverables Panel */}
        <ItemPanel
          title="Deliverables"
          items={deliverables}
          selectedId={selectedDeliverable}
          highlightedIds={highlightedItems.deliverableIds}
          expandedIds={expandedDeliverable}
          setExpandedIds={setExpandedDeliverable}
          searchTerm={searchDeliverable}
          setSearchTerm={setSearchDeliverable}
          onSelect={setSelectedDeliverable}
          getLinkCount={getDeliverableLinkCount}
          isMapped={isDeliverableMapped}
          emptyMessage="No deliverables. Create items in Deliverables page."
        />
      </div>

      {/* Link Action Bar */}
      <div className="p-4 border-t bg-white">
        <div className="flex items-center justify-between">
          {/* Selected Items */}
          <div className="flex items-center gap-2 text-sm">
            {selectedCost && (
              <span className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full flex items-center gap-2">
                <span className="font-medium">Cost:</span> {selectedCostItem?.code} {selectedCostItem?.name?.substring(0, 20)}
                <button onClick={() => setSelectedCost(null)} className="hover:text-blue-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedProgramme && (
              <span className="px-3 py-1.5 bg-purple-100 text-purple-800 rounded-full flex items-center gap-2">
                <span className="font-medium">Programme:</span> {selectedProgrammeTask?.code || ''} {selectedProgrammeTask?.name?.substring(0, 20)}
                <button onClick={() => setSelectedProgramme(null)} className="hover:text-purple-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedDeliverable && (
              <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full flex items-center gap-2">
                <span className="font-medium">Deliverable:</span> {selectedDeliverableItem?.code} {selectedDeliverableItem?.name?.substring(0, 20)}
                <button onClick={() => setSelectedDeliverable(null)} className="hover:text-green-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {!selectedCost && !selectedProgramme && !selectedDeliverable && (
              <span className="text-gray-500">Select items from panels above to create links</span>
            )}
          </div>

          {/* Link Buttons */}
          <div className="flex items-center gap-2">
            {selectedCost && selectedProgramme && (
              costProgrammeLinkExists ? (
                <button
                  onClick={handleRemoveCostProgrammeLink}
                  className="btn btn-secondary flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Cost-Programme
                </button>
              ) : (
                <button
                  onClick={() => handleCreateLink('cost-programme')}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <LinkIcon className="w-4 h-4" />
                  Link Cost-Programme
                </button>
              )
            )}
            {selectedProgramme && selectedDeliverable && (
              programmeDeliverableLinkExists ? (
                <button
                  onClick={handleRemoveProgrammeDeliverableLink}
                  className="btn btn-secondary flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Programme-Deliverable
                </button>
              ) : (
                <button
                  onClick={() => handleCreateLink('programme-deliverable')}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <LinkIcon className="w-4 h-4" />
                  Link Programme-Deliverable
                </button>
              )
            )}
            {selectedCost && selectedDeliverable && (
              costDeliverableLinkExists ? (
                <button
                  onClick={handleRemoveCostDeliverableLink}
                  className="btn btn-secondary flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Cost-Deliverable
                </button>
              ) : (
                <button
                  onClick={() => handleCreateLink('cost-deliverable')}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <LinkIcon className="w-4 h-4" />
                  Link Cost-Deliverable
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Link Modal */}
      {showLinkModal && linkType && (
        <LinkModal
          linkType={linkType}
          costItem={selectedCostItem}
          programmeTask={selectedProgrammeTask}
          deliverable={selectedDeliverableItem}
          onClose={() => { setShowLinkModal(false); setLinkType(null); }}
          onSave={handleSaveLink}
          isLoading={createCostProgrammeMutation.isPending || createProgrammeDeliverableMutation.isPending || createCostDeliverableMutation.isPending}
        />
      )}
    </div>
  );
}

// Panel Component for each of the three columns
interface ItemPanelProps {
  title: string;
  items: any[];
  selectedId: string | null;
  highlightedIds: Set<string>;
  expandedIds: Set<string>;
  setExpandedIds: (ids: Set<string>) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onSelect: (id: string | null) => void;
  getLinkCount: (id: string) => number;
  isMapped: (id: string) => boolean;
  emptyMessage: string;
}

function ItemPanel({
  title, items, selectedId, highlightedIds, expandedIds, setExpandedIds,
  searchTerm, setSearchTerm, onSelect, getLinkCount, isMapped, emptyMessage
}: ItemPanelProps) {
  // Filter by search
  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter((item: any) =>
      item.name?.toLowerCase().includes(term) ||
      item.code?.toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  // Build hierarchy
  const hierarchicalItems = useMemo(() => {
    const buildHierarchy = (parentId: string | null = null): any[] => {
      return filteredItems
        .filter((item: any) => item.parent_id === parentId)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((item: any) => ({
          ...item,
          children: buildHierarchy(item.id),
        }));
    };
    return buildHierarchy(null);
  }, [filteredItems]);

  // Flatten for display
  const flattenItems = (items: any[], depth = 0): any[] => {
    const result: any[] = [];
    for (const item of items) {
      result.push({ ...item, depth });
      if (item.children?.length > 0 && expandedIds.has(item.id)) {
        result.push(...flattenItems(item.children, depth + 1));
      }
    }
    return result;
  };

  const displayItems = flattenItems(hierarchicalItems);
  const hasChildren = (id: string) => items.some((item: any) => item.parent_id === id);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  return (
    <div className="bg-white rounded-lg shadow flex flex-col overflow-hidden">
      {/* Panel Header */}
      <div className="p-3 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-auto">
        {displayItems.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {items.length === 0 ? emptyMessage : 'No items match search'}
          </div>
        ) : (
          displayItems.map((item: any) => {
            const isSelected = item.id === selectedId;
            const isHighlighted = highlightedIds.has(item.id);
            const linkCount = getLinkCount(item.id);
            const mapped = isMapped(item.id);
            const hasChildItems = hasChildren(item.id);
            const isExpanded = expandedIds.has(item.id);

            return (
              <div
                key={item.id}
                onClick={() => onSelect(isSelected ? null : item.id)}
                className={`
                  px-3 py-2 border-b cursor-pointer transition-all
                  ${isSelected ? 'bg-primary-100 border-l-4 border-l-primary-500' : ''}
                  ${isHighlighted && !isSelected ? 'bg-blue-50 border-l-4 border-l-blue-400' : ''}
                  ${!isSelected && !isHighlighted ? 'hover:bg-gray-50 border-l-4 border-l-transparent' : ''}
                `}
                style={{ paddingLeft: `${item.depth * 16 + 12}px` }}
              >
                <div className="flex items-center gap-2">
                  {/* Expand/Collapse */}
                  {hasChildItems ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
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

                  {/* Mapping Status Indicator */}
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    mapped ? 'bg-green-500' : 'bg-amber-400'
                  }`} />

                  {/* Item Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {item.code && (
                        <span className="text-xs text-gray-400 font-mono">{item.code}</span>
                      )}
                      <span className={`text-sm truncate ${item.level === 1 || item.depth === 0 ? 'font-medium' : ''}`}>
                        {item.name}
                      </span>
                    </div>
                  </div>

                  {/* Link Count Badge */}
                  {linkCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded flex-shrink-0">
                      {linkCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Panel Footer */}
      <div className="p-2 border-t bg-gray-50 text-xs text-gray-500">
        {items.length} items | {items.filter((i: any) => isMapped(i.id)).length} mapped
      </div>
    </div>
  );
}

// Link Modal Component
interface LinkModalProps {
  linkType: LinkType;
  costItem?: WBSItem;
  programmeTask?: ProgrammeTask;
  deliverable?: RevenueItem;
  onClose: () => void;
  onSave: (allocationType: string, allocationPercent: number, notes: string) => void;
  isLoading: boolean;
}

function LinkModal({ linkType, costItem, programmeTask, deliverable, onClose, onSave, isLoading }: LinkModalProps) {
  const [allocationType, setAllocationType] = useState<'percent' | 'fixed_value'>('percent');
  const [allocationPercent, setAllocationPercent] = useState(100);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(allocationType, allocationPercent, notes);
  };

  const getLinkTitle = () => {
    switch (linkType) {
      case 'cost-programme': return 'Cost-Programme Link';
      case 'programme-deliverable': return 'Programme-Deliverable Link';
      case 'cost-deliverable': return 'Cost-Deliverable Link';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            Create {getLinkTitle()}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Items Info */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            {(linkType === 'cost-programme' || linkType === 'cost-deliverable') && costItem && (
              <div>
                <div className="text-xs text-gray-500 uppercase">Cost Item</div>
                <div className="font-medium text-sm">
                  <span className="text-gray-400 mr-1">{costItem.code}</span>
                  {costItem.name}
                </div>
                <div className="text-xs text-gray-500">{formatCurrency(costItem.total_cost || 0)}</div>
              </div>
            )}
            {(linkType === 'cost-programme' || linkType === 'programme-deliverable') && programmeTask && (
              <div>
                <div className="text-xs text-gray-500 uppercase">Programme Task</div>
                <div className="font-medium text-sm">
                  {programmeTask.code && <span className="text-gray-400 mr-1">{programmeTask.code}</span>}
                  {programmeTask.name}
                </div>
                <div className="text-xs text-gray-500">{programmeTask.duration_days}d</div>
              </div>
            )}
            {(linkType === 'programme-deliverable' || linkType === 'cost-deliverable') && deliverable && (
              <div>
                <div className="text-xs text-gray-500 uppercase">Deliverable</div>
                <div className="font-medium text-sm">
                  <span className="text-gray-400 mr-1">{deliverable.code}</span>
                  {deliverable.name}
                </div>
                <div className="text-xs text-gray-500">{formatCurrency(deliverable.contract_value || 0)}</div>
              </div>
            )}
          </div>

          {/* Allocation Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Allocation Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {allocationType === 'percent' ? 'Allocation %' : 'Fixed Value'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={allocationPercent}
                onChange={(e) => setAllocationPercent(parseFloat(e.target.value) || 0)}
                className="input w-32"
                min="0"
                max={allocationType === 'percent' ? 100 : undefined}
                step="5"
              />
              <span className="text-gray-500">{allocationType === 'percent' ? '%' : '$'}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input w-full"
              rows={2}
              placeholder="Add any notes about this link..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn btn-primary flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              {isLoading ? 'Creating...' : 'Create Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
