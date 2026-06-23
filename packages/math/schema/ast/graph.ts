import {
  type ConstantMathAstRead,
  readConstantMathAst,
} from "@repo/math/schema/ast/constant";
import type { MathAst, MathAstNode } from "@repo/math/schema/ast/schema";
import { readSortableExactScalar } from "@repo/math/schema/coordinate/scalar";

/**
 * Finds structural and operation-level issues in a decoded MathAst graph.
 */
export function findMathAstGraphIssue(ast: MathAst) {
  const nodesById = new Map<string, MathAstNode>();

  for (const node of ast.nodes) {
    const issue = addMathAstNode(node, nodesById);
    if (issue) {
      return issue;
    }
  }

  if (!nodesById.has(ast.root)) {
    return `MathAst root node was not found: ${ast.root}.`;
  }

  const childrenByNodeId = new Map<string, string[]>();
  const referenceIssue = connectMathAstNodes(nodesById, childrenByNodeId);
  if (referenceIssue) {
    return referenceIssue;
  }

  return findReachabilityIssue(ast.root, nodesById, childrenByNodeId);
}

/**
 * Adds one node to the id map and rejects duplicate or nonsortable literals.
 */
function addMathAstNode(
  node: MathAstNode,
  nodesById: Map<string, MathAstNode>
) {
  if (nodesById.has(node.id)) {
    return `Duplicate MathAst node id: ${node.id}.`;
  }

  if (
    node.kind === "literal" &&
    readSortableExactScalar(node.value) === undefined
  ) {
    return `MathAst literal node ${node.id} must use a sortable numeric value.`;
  }

  nodesById.set(node.id, node);
}

/**
 * Builds adjacency lists and validates operation-level child semantics.
 */
function connectMathAstNodes(
  nodesById: ReadonlyMap<string, MathAstNode>,
  childrenByNodeId: Map<string, string[]>
) {
  const constantValuesByNodeId = new Map<string, ConstantMathAstRead>();

  for (const node of nodesById.values()) {
    const issue = connectOneMathAstNode(
      node,
      nodesById,
      childrenByNodeId,
      constantValuesByNodeId
    );
    if (issue) {
      return issue;
    }
  }
}

/**
 * Validates child references for one node and records its child ids.
 */
function connectOneMathAstNode(
  node: MathAstNode,
  nodesById: ReadonlyMap<string, MathAstNode>,
  childrenByNodeId: Map<string, string[]>,
  constantValuesByNodeId: Map<string, ConstantMathAstRead>
) {
  const childNodeIds: string[] = [];

  for (const childRef of readMathAstChildRefs(node)) {
    const childNode = nodesById.get(childRef.id);
    if (!childNode) {
      return `MathAst ${node.kind} node ${node.id} references missing ${childRef.role} ${childRef.id}.`;
    }

    if (
      isConstantZeroDivisor(
        node,
        childRef.role,
        childNode,
        nodesById,
        constantValuesByNodeId
      )
    ) {
      return `MathAst divide node ${node.id} cannot use a constant zero divisor.`;
    }

    childNodeIds.push(childNode.id);
  }

  const constantRead = readConstantMathAst(
    node,
    nodesById,
    constantValuesByNodeId
  );
  if (constantRead.tag === "InvalidConstant") {
    return `MathAst node ${node.id} contains an invalid constant expression.`;
  }

  if (childNodeIds.length > 0) {
    childrenByNodeId.set(node.id, childNodeIds);
  }
}

/**
 * Detects divide operations whose right child is deterministically zero.
 */
function isConstantZeroDivisor(
  node: MathAstNode,
  role: string,
  childNode: MathAstNode,
  nodesById: ReadonlyMap<string, MathAstNode>,
  constantValuesByNodeId: Map<string, ConstantMathAstRead>
) {
  if (
    node.kind !== "binary" ||
    node.operator !== "divide" ||
    role !== "right operand"
  ) {
    return false;
  }

  const constantRead = readConstantMathAst(
    childNode,
    nodesById,
    constantValuesByNodeId
  );

  return (
    constantRead.tag === "Constant" && constantRead.value.isExactZero === true
  );
}

/**
 * Walks from root without recursion to reject cycles and unreachable nodes.
 */
function findReachabilityIssue(
  rootNodeId: string,
  nodesById: ReadonlyMap<string, MathAstNode>,
  childrenByNodeId: ReadonlyMap<string, readonly string[]>
) {
  const reachableNodeIds = new Set<string>();
  const visitingNodeIds = new Set<string>();
  const stack = [{ exiting: false, nodeId: rootNodeId }];

  for (let frame = stack.pop(); frame !== undefined; frame = stack.pop()) {
    if (frame.exiting) {
      visitingNodeIds.delete(frame.nodeId);
      reachableNodeIds.add(frame.nodeId);
      continue;
    }

    if (reachableNodeIds.has(frame.nodeId)) {
      continue;
    }

    if (visitingNodeIds.has(frame.nodeId)) {
      return `MathAst graph contains a cycle at node ${frame.nodeId}.`;
    }

    visitingNodeIds.add(frame.nodeId);
    stack.push({ exiting: true, nodeId: frame.nodeId });

    for (const childNodeId of childrenByNodeId.get(frame.nodeId) ?? []) {
      stack.push({ exiting: false, nodeId: childNodeId });
    }
  }

  for (const nodeId of nodesById.keys()) {
    if (!reachableNodeIds.has(nodeId)) {
      return `MathAst node is unreachable from root: ${nodeId}.`;
    }
  }
}

/**
 * Reads ordered child references with user-facing role labels.
 */
function readMathAstChildRefs(node: MathAstNode) {
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
