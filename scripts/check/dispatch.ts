import { Array as Arr } from "effect";
import {
  isSwitchStatement,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import { candidate } from "#scripts/check/rules";

/**
 * Describes one candidate per switch statement among one module's
 * value-position nodes. A switch picks a branch by the value's shape, which
 * Match from effect names with its tag and discriminator matchers.
 */
export function dispatchCandidates(
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  return Arr.map(Arr.filter(nodes, isSwitchStatement), (node) =>
    candidate("switch", sourceFile, node)
  );
}
