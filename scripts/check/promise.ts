import { Array as Arr } from "effect";
import {
  isAsyncKeyword,
  isAwaitExpression,
  isForOfStatement,
  isFunctionLikeDeclaration,
  isIdentifier,
  isNewExpression,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import { insideHandler } from "#scripts/check/handler";
import { candidate } from "#scripts/check/rules";
import { workflowHandlers } from "#scripts/check/workflow";
import { unwrapped } from "#scripts/check/wrapper";

/** Whether a node declares an async function or waits on a Promise. */
function isPromiseSyntax(node: Node) {
  return (
    (isFunctionLikeDeclaration(node) &&
      Arr.some(node.modifiers ?? [], isAsyncKeyword)) ||
    isAwaitExpression(node) ||
    (isForOfStatement(node) && node.awaitModifier !== undefined)
  );
}

/**
 * Returns the candidate for `new Promise(...)`, which counts while `Promise`
 * binds to the platform global, so a class or a binding named Promise does not.
 */
function newPromiseCandidates(sourceFile: SourceFile, node: Node) {
  if (!isNewExpression(node)) {
    return [];
  }
  const callee = unwrapped(node.expression);
  return isIdentifier(callee) && callee.text === "Promise"
    ? [candidate("new-promise", sourceFile, node, callee)]
    : [];
}

/**
 * Returns the Promise syntax among one module's value-position `nodes` that
 * Effect replaces: async functions, `await`, and `for await` outside Confect
 * workflow handlers, and `new Promise`.
 */
export function promiseCandidates(
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  const handlers = workflowHandlers(sourceFile, nodes);
  return Arr.flatMap(nodes, (node) =>
    isPromiseSyntax(node) && !insideHandler(node, handlers)
      ? [candidate("promise", sourceFile, node)]
      : newPromiseCandidates(sourceFile, node)
  );
}
