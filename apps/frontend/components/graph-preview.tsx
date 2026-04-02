'use client';

import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';

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
};

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

function styleForType(type: string, scopeType: string): Record<string, string | number> {
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
    border: `1px solid ${scopeType === 'cluster' ? '#f59e0b' : palette.border}`,
    padding: 12,
    borderRadius: 12,
    width: 220,
  };
}

export function GraphPreview({ nodes, edges, onNodeSelect }: GraphPreviewProps): JSX.Element {
  const flowNodes: Node[] =
    nodes && nodes.length > 0
      ? nodes.map((node, index) => ({
          id: node.id,
          position: { x: columnForType(node.type) * 280, y: 40 + (index % 6) * 110 },
          data: {
            label: [node.label, node.namespace ? `ns:${node.namespace}` : node.scopeType].join(
              ' • ',
            ),
            originalNode: node,
          },
          style: styleForType(node.type, node.scopeType),
        }))
      : fallbackNodes;

  const flowEdges: Edge[] =
    edges && edges.length > 0
      ? edges.map((edge) => ({
          ...edge,
          markerEnd: { type: MarkerType.ArrowClosed },
        }))
      : fallbackEdges;

  const handleNodeClick: NodeMouseHandler = (_, node) => {
    const originalNode = (node.data as { originalNode?: GraphDisplayNode }).originalNode;
    if (originalNode && onNodeSelect) {
      onNodeSelect(originalNode);
    }
  };

  return (
    <div className="h-[560px] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 lg:h-[680px] xl:h-[760px]">
      <ReactFlow fitView nodes={flowNodes} edges={flowEdges} onNodeClick={handleNodeClick}>
        <Background color="#334155" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
