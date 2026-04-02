'use client';

import {
  Background,
  Controls,
  type EdgeMarker,
  Handle,
  MiniMap,
  MarkerType,
  Position,
  type ReactFlowInstance,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';

const fallbackNodes = [
  {
    id: 'subject',
    position: { x: 0, y: 80 },
    data: { label: 'User: demo-user' },
    style: { background: '#0f172a', color: '#fff', border: '1px solid #334155', padding: 12 },
  },
  {
    id: 'binding',
    position: { x: 260, y: 80 },
    data: { label: 'RoleBinding: read-pods' },
    style: { background: '#1e293b', color: '#fff', border: '1px solid #475569', padding: 12 },
  },
  {
    id: 'role',
    position: { x: 540, y: 80 },
    data: { label: 'Role: pods-reader' },
    style: { background: '#1d4ed8', color: '#fff', border: '1px solid #60a5fa', padding: 12 },
  },
];

const fallbackEdges = [
  { id: 'e1', source: 'subject', target: 'binding', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e2', source: 'binding', target: 'role', markerEnd: { type: MarkerType.ArrowClosed } },
];

type GraphDisplayNode = {
  id: string;
  type: string;
  label: string;
  scopeType: string;
  namespace: string | null;
  kind?: string;
  badges?: string[];
  metadataRef?: {
    kind: string;
    name: string;
    namespace: string | null;
  };
  subjectKind?: string;
  apiGroups?: string[];
  resources?: string[];
  verbs?: string[];
  ruleCount?: number;
};

type GraphNodeData = {
  title: string;
  subtitle: string;
  meta: string;
  originalNode: GraphDisplayNode;
};

type GraphPreviewProps = {
  nodes?: GraphDisplayNode[];
  edges?: Array<{
    id: string;
    type?: string;
    source: string;
    target: string;
    explain?: string;
    scopeType?: string;
    namespace?: string | null;
  }>;
  onNodeSelect?: (node: GraphDisplayNode) => void;
  selectedNodeId?: string | null;
  fitViewSignal?: number;
};

function iconForNodeType(type: string): string {
  if (type === 'subject') {
    return '◎';
  }

  if (type === 'binding') {
    return '⇄';
  }

  if (type === 'role') {
    return '◆';
  }

  return '◌';
}

function edgeLabelForType(type?: string): string {
  if (type === 'subject_binding') {
    return 'bound';
  }

  if (type === 'binding_role') {
    return 'roleRef';
  }

  if (type === 'role_permission') {
    return 'grants';
  }

  return 'path';
}

function formatNodeData(node: GraphDisplayNode): GraphNodeData {
  return {
    title: node.label,
    subtitle: node.kind ?? node.type,
    meta: node.namespace ? `ns:${node.namespace}` : node.scopeType,
    originalNode: node,
  };
}

function CustomGraphNode({ data }: { data: GraphNodeData }): JSX.Element {
  const node = data.originalNode;

  return (
    <div className="min-w-[236px] rounded-2xl bg-transparent px-1 py-1 text-left text-white">
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-0 !bg-transparent !opacity-0"
      />
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold text-white/90 ring-1 ring-white/10">
          {iconForNodeType(node.type)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-[-0.01em] text-white">
            {data.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-300">
            <span>{data.subtitle}</span>
            <span className="h-1 w-1 rounded-full bg-slate-500" />
            <span>{data.meta}</span>
          </div>
          {node.badges && node.badges.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {node.badges.slice(0, 3).map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200"
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-0 !bg-transparent !opacity-0"
      />
    </div>
  );
}

function columnForType(type: string): number {
  if (type === 'subject') {
    return 0;
  }

  if (type === 'binding') {
    return 1;
  }

  if (type === 'role') {
    return 2;
  }

  return 3;
}

function styleForType(
  type: string,
  scopeType: string,
  selected: boolean,
): Record<string, string | number> {
  const palette =
    type === 'subject'
      ? { background: '#0f172a', border: '#334155' }
      : type === 'binding'
        ? { background: '#1f2937', border: '#f97316' }
        : type === 'role'
          ? { background: '#1d4ed8', border: '#60a5fa' }
          : { background: '#111827', border: '#64748b' };

  return {
    background: palette.background,
    color: '#ffffff',
    border: `1px solid ${selected ? '#22d3ee' : scopeType === 'cluster' ? '#f59e0b' : palette.border}`,
    padding: 12,
    borderRadius: 14,
    boxShadow: selected
      ? '0 0 0 1px rgba(34,211,238,0.25), 0 16px 38px rgba(2,6,23,0.45)'
      : '0 10px 24px rgba(2,6,23,0.35)',
    width: 252,
    fontSize: 12,
    lineHeight: 1.35,
  };
}

function layoutNodes(nodes: GraphDisplayNode[]): Node[] {
  const groupedByType = new Map<string, GraphDisplayNode[]>();

  for (const node of nodes) {
    const bucket = groupedByType.get(node.type) ?? [];
    bucket.push(node);
    groupedByType.set(node.type, bucket);
  }

  return nodes.map((node) => {
    const bucket = groupedByType.get(node.type) ?? [node];
    const index = bucket.findIndex((item) => item.id === node.id);
    const column = columnForType(node.type);
    const rowHeight = node.type === 'permission_summary' ? 120 : 132;
    const x = column * 340;
    const y = 56 + index * rowHeight;

    return {
      id: node.id,
      position: { x, y },
      type: 'custom',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: formatNodeData(node),
      style: styleForType(node.type, node.scopeType, false),
    } satisfies Node;
  });
}

export function GraphPreview({
  nodes,
  edges,
  onNodeSelect,
  selectedNodeId,
  fitViewSignal,
}: GraphPreviewProps): JSX.Element {
  const [instance, setInstance] = useState<ReactFlowInstance | null>(null);

  const nodeTypes = useMemo(() => ({ custom: CustomGraphNode }), []);

  const flowNodes: Node[] = useMemo(
    () =>
      nodes && nodes.length > 0
        ? layoutNodes(nodes).map((node) => ({
            ...node,
            style: styleForType(
              (node.data as GraphNodeData).originalNode.type,
              (node.data as GraphNodeData).originalNode.scopeType,
              node.id === selectedNodeId,
            ),
          }))
        : fallbackNodes,
    [nodes, selectedNodeId],
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      edges && edges.length > 0
        ? edges.map((edge) => ({
            ...edge,
            type: 'smoothstep',
            label: edgeLabelForType(edge.type),
            labelStyle: {
              fill: '#cbd5e1',
              fontSize: 11,
              fontWeight: 600,
            },
            labelBgPadding: [6, 3] as [number, number],
            labelBgBorderRadius: 999,
            labelBgStyle: {
              fill: '#020617',
              opacity: 0.92,
            },
            style: {
              stroke: edge.scopeType === 'cluster' ? '#f59e0b' : '#cbd5e1',
              strokeOpacity: 1,
              strokeWidth: edge.scopeType === 'cluster' ? 2.4 : 2,
            },
            interactionWidth: 24,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: edge.scopeType === 'cluster' ? '#f59e0b' : '#cbd5e1',
            } as EdgeMarker,
          }))
        : fallbackEdges,
    [edges],
  );

  useEffect(() => {
    if (!instance) {
      return;
    }

    void instance.fitView({ duration: 300, padding: 0.2 });
  }, [fitViewSignal, instance, flowNodes.length, flowEdges.length]);

  const handleNodeClick: NodeMouseHandler = (_, node) => {
    const originalNode = (node.data as { originalNode?: GraphDisplayNode }).originalNode;
    if (originalNode && onNodeSelect) {
      onNodeSelect(originalNode);
    }
  };

  return (
    <div className="h-[560px] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 lg:h-[680px] xl:h-[760px]">
      <ReactFlow
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onInit={setInstance}
        onNodeClick={handleNodeClick}
      >
        <Background color="#334155" gap={20} />
        <MiniMap
          pannable
          zoomable
          style={{ background: '#020617', border: '1px solid rgba(148, 163, 184, 0.3)' }}
          nodeColor={(node) => {
            if (node.id === selectedNodeId) {
              return '#22d3ee';
            }

            return '#475569';
          }}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
