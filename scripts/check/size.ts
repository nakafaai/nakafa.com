import { Array as Arr, String as Str } from "effect";
import type { SourceFile } from "typescript/unstable/ast";
import { isGenerated } from "#scripts/check/source";

/** The most lines a hand-written module may have. */
const MAXIMUM_LINES = 500;

/**
 * Reports a hand-written module that is longer than the limit. A module that
 * long holds more than one capability, so it is split by capability, each part
 * beside its own test. A module that a tool generated is not judged.
 */
export function inspectModuleSize(
  file: string,
  sourceFile: SourceFile
): readonly string[] {
  if (isGenerated(sourceFile)) {
    return [];
  }
  const lines = Arr.fromIterable(Str.linesIterator(sourceFile.text)).length;
  return lines > MAXIMUM_LINES
    ? [
        `${file}: split this module by capability: it has ${lines} lines, and a hand-written module has at most ${MAXIMUM_LINES}.`,
      ]
    : [];
}
