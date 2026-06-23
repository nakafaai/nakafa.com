import type { MathAst, MathAstNode } from "@repo/math/schema/ast";
import {
  type ConstantMathAstRead,
  readConstantMathAst,
} from "@repo/math/schema/ast-constant";
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
  const nodesById = new Map<string, MathAstNode>();

  for (const node of ast.nodes) {
    const issue = addMathAstEdge(node, edges, edgesByNodeId);
    if (issue) {
      return issue;
    }

    nodesById.set(node.id, node);
  }

  const rootEdge = edgesByNodeId.get(ast.root);
  if (!rootEdge) {
    return `MathAst root node was not found: ${ast.root}.`;
  }

  const referenceIssue = connectMathAstEdges(edges, edgesByNodeId, nodesById);
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
  edgesByNodeId: ReadonlyMap<string, MathAstEdge>,
  nodesById: ReadonlyMap<string, MathAstNode>
) {
  const constantValuesByNodeId = new Map<string, ConstantMathAstRead>();

  for (const edge of edges) {
    const issue = connectOneMathAstEdge(
      edge,
      edgesByNodeId,
      nodesById,
      constantValuesByNodeId
    );
    if (issue) {
      return issue;
    }
  }
}

function connectOneMathAstEdge(
  edge: MathAstEdge,
  edgesByNodeId: ReadonlyMap<string, MathAstEdge>,
  nodesById: ReadonlyMap<string, MathAstNode>,
  constantValuesByNodeId: Map<string, ConstantMathAstRead>
) {
  const childRefs = readMathAstChildRefs(edge.node);
  const childEdges: { edge: MathAstEdge; ref: MathAstChildRef }[] = [];

  for (const ref of childRefs) {
    const childEdge = edgesByNodeId.get(ref.id);
    if (!childEdge) {
      return `MathAst ${edge.node.kind} node ${edge.node.id} references missing ${ref.role} ${ref.id}.`;
    }

    childEdges.push({ edge: childEdge, ref });
  }

  const constantRead = readConstantMathAst(
    edge.node,
    nodesById,
    constantValuesByNodeId
  );
  if (constantRead.tag === "InvalidConstant") {
    return `MathAst node ${edge.node.id} contains an invalid constant expression.`;
  }

  for (const child of childEdges) {
    if (
      isConstantZeroDivisor(
        edge.node,
        child.ref,
        child.edge,
        nodesById,
        constantValuesByNodeId
      )
    ) {
      return `MathAst divide node ${edge.node.id} cannot use a constant zero divisor.`;
    }

    edge.children.push(child.edge);
  }
}

function isConstantZeroDivisor(
  node: MathAstNode,
  ref: MathAstChildRef,
  childEdge: MathAstEdge,
  nodesById: ReadonlyMap<string, MathAstNode>,
  constantValuesByNodeId: Map<string, ConstantMathAstRead>
) {
  if (
    node.kind !== "binary" ||
    node.operator !== "divide" ||
    ref.role !== "right operand"
  ) {
    return false;
  }

  const constantRead = readConstantMathAst(
    childEdge.node,
    nodesById,
    constantValuesByNodeId
  );

  return (
    constantRead.tag === "Constant" && constantRead.value.isExactZero === true
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
