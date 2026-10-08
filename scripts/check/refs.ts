import { Array as Arr, Result } from "effect";
import {
  isStringLiteralLikeNode,
  type SourceFile,
} from "typescript/unstable/ast";
import { descendants, namesModule } from "#scripts/check/source";

/** The generated refs of the whole backend contract, which a browser module that imports it ships in full. */
const WHOLE_TREE = "@repo/backend/confect/_generated/refs";
/** The folders whose modules run in the browser, so their imports ship with the page. */
const BROWSER_FOLDERS = ["apps/www/"];
const RULE = `import the per-domain refs of each domain the module uses, such as ${WHOLE_TREE}/nina for refs.public.nina, instead of the whole ${WHOLE_TREE} tree`;

/** Whether a module runs in the browser, where its imports ship with the page. */
function runsInBrowser(file: string) {
  return Arr.some(BROWSER_FOLDERS, (folder) => file.startsWith(folder));
}

/**
 * Reports each import of the whole backend refs tree from a browser module: a
 * value or type import, a re-export, or a dynamic import. Server modules keep
 * the whole tree.
 */
export function inspectRefsSource(file: string, sourceFile: SourceFile) {
  if (!runsInBrowser(file)) {
    return [];
  }
  return Arr.filterMap(descendants(sourceFile, false), (node) =>
    isStringLiteralLikeNode(node) &&
    node.text === WHOLE_TREE &&
    namesModule(node)
      ? Result.succeed(`${file}: ${RULE}.`)
      : Result.failVoid
  );
}
