import type { MathAst, MathAstNode } from "@repo/math/schema/ast";
import { readSortableExactScalar } from "@repo/math/schema/coordinate-scalars";

interface MathAstEdge {
  children: MathAstEdge[];
  node: MathAstNode;
}

interface MathAstChildRef {
  id: string;
  role: "left operand" | "operand" | "right operand";
}

/** Finds structural and operation-level issues in a decoded MathAst graph. */
export function findMathAstGraphIssue(ast: MathAst) {
  const edges: MathAstEdge[] = [];
  const edgesByNodeId = new Map<string, MathAstEdge>();

  for (const node of ast.nodes) {
    const issue = addMathAstEdge(node, edges, edgesByNodeId);
    if (issue) {
      return issue;
    }
  }

  const rootEdge = edgesByNodeId.get(ast.root);
  if (!rootEdge) {
    return `MathAst root node was not found: ${ast.root}.`;
  }

  const referenceIssue = connectMathAstEdges(edges, edgesByNodeId);
  if (referenceIssue) {
    return referenceIssue;
  }

  return findReachabilityIssue(rootEdge, edges);
}

function addMathAstEdge(
  node: MathAstNode,
  edges: MathAstEdge[],
  edgesByNodeId: Map<string, MathAstEdge>
) {
  if (edgesByNodeId.has(node.id)) {
    return `Duplicate MathAst node id: ${node.id}.`;
  }

  if (
    node.kind === "literal" &&
    readSortableExactScalar(node.value) === undefined
  ) {
    return `MathAst literal node ${node.id} must use a sortable numeric value.`;
  }

  const edge = { children: [], node };
  edges.push(edge);
  edgesByNodeId.set(node.id, edge);
}

function connectMathAstEdges(
  edges: readonly MathAstEdge[],
  edgesByNodeId: ReadonlyMap<string, MathAstEdge>
) {
  for (const edge of edges) {
    const issue = connectOneMathAstEdge(edge, edgesByNodeId);
    if (issue) {
      return issue;
    }
  }
}

function connectOneMathAstEdge(
  edge: MathAstEdge,
  edgesByNodeId: ReadonlyMap<string, MathAstEdge>
) {
  for (const ref of readMathAstChildRefs(edge.node)) {
    const childEdge = edgesByNodeId.get(ref.id);
    if (!childEdge) {
      return `MathAst ${edge.node.kind} node ${edge.node.id} references missing ${ref.role} ${ref.id}.`;
    }

    if (isLiteralZeroDivisor(edge.node, ref, childEdge.node)) {
      return `MathAst divide node ${edge.node.id} cannot use a literal zero divisor.`;
    }

    edge.children.push(childEdge);
  }
}

function isLiteralZeroDivisor(
  node: MathAstNode,
  ref: MathAstChildRef,
  childNode: MathAstNode
) {
  return (
    node.kind === "binary" &&
    node.operator === "divide" &&
    ref.role === "right operand" &&
    childNode.kind === "literal" &&
    readSortableExactScalar(childNode.value) === 0
  );
}

function findReachabilityIssue(
  rootEdge: MathAstEdge,
  edges: readonly MathAstEdge[]
) {
  const reachableNodeIds = new Set<string>();
  const visitingNodeIds = new Set<string>();
  const stack = [{ edge: rootEdge, exiting: false }];

  for (let frame = stack.pop(); frame !== undefined; frame = stack.pop()) {
    const nodeId = frame.edge.node.id;

    if (frame.exiting) {
      visitingNodeIds.delete(nodeId);
      reachableNodeIds.add(nodeId);
      continue;
    }

    if (reachableNodeIds.has(nodeId)) {
      continue;
    }

    if (visitingNodeIds.has(nodeId)) {
      return `MathAst graph contains a cycle at node ${nodeId}.`;
    }

    visitingNodeIds.add(nodeId);
    stack.push({ edge: frame.edge, exiting: true });

    for (const childEdge of frame.edge.children) {
      stack.push({ edge: childEdge, exiting: false });
    }
  }

  for (const edge of edges) {
    if (!reachableNodeIds.has(edge.node.id)) {
      return `MathAst node is unreachable from root: ${edge.node.id}.`;
    }
  }
}

function readMathAstChildRefs(node: MathAstNode): MathAstChildRef[] {
  if (node.kind === "unary") {
    return [{ id: node.operand, role: "operand" }];
  }

  if (node.kind === "binary") {
    return [
      { id: node.left, role: "left operand" },
      { id: node.right, role: "right operand" },
    ];
  }

  return [];
}
