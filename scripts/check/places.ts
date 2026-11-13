import type { Node, SourceFile } from "tsrs/ast";

/** Where a node stands, as `file:line`, so a finding names the line to change. */
export function place(file: string, sourceFile: SourceFile, node: Node) {
  return `${file}:${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1}`;
}
