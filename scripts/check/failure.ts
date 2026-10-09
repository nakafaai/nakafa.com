import { Array as Arr } from "effect";
import {
  isThrowStatement,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import { candidate } from "#scripts/check/rules";

/**
 * Describes one candidate per throw statement among one module's
 * value-position nodes. A throw leaves the Effect error channel, where a tagged
 * error keeps the failure typed and each caller can handle it by its tag.
 */
export function failureCandidates(
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  return Arr.map(Arr.filter(nodes, isThrowStatement), (node) =>
    candidate("throw", sourceFile, node)
  );
}
