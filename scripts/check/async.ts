import { Array as Arr } from "effect";
import type { Node, SourceFile } from "typescript/unstable/ast";
import { isPromiseSyntax } from "#scripts/check/native";
import { candidate, covers } from "#scripts/check/rules";

/**
 * Describes one candidate per async function, await expression, and for-await
 * loop among one module's value-position nodes, unless the promise rule judges
 * the module. The promise rule covers the strict domain folders, tests
 * excluded, so this rule reports the rest of the repository, tests included.
 */
export function asyncCandidates(
  file: string,
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  if (covers("promise", file, sourceFile)) {
    return [];
  }
  return Arr.map(Arr.filter(nodes, isPromiseSyntax), (node) =>
    candidate("async", sourceFile, node)
  );
}
