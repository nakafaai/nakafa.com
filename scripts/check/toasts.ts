import { Array as Arr, HashSet } from "effect";
import {
  isStringLiteralLikeNode,
  type SourceFile,
} from "typescript/unstable/ast";
import { descendants, namesModule } from "#scripts/check/source";

/** The toast library, which only the Toaster and the toast helper import. */
const TOAST_LIBRARY = "sonner";
/** The Toaster and the helper that shows every toast: the only modules that import the library. */
const TOAST_MODULES = HashSet.make(
  "packages/design-system/components/ui/sonner.tsx",
  "packages/design-system/lib/toast/notify.ts"
);
const SONNER_RULE = `import { toast } from @repo/design-system/lib/toast/notify instead of ${TOAST_LIBRARY}, which only the Toaster and that helper import`;
const TEST_MODULE_PATTERN = /\.test\.tsx?$/u;

/**
 * Reports the toast rule that the types cannot state: an import of the toast
 * library outside the Toaster and the helper. The copy itself is typed, since
 * every title and description is a key of the `Toast` namespace. Test modules
 * are not judged, because they never ship and may test the library and the
 * helper.
 */
export function inspectToastSource(file: string, sourceFile: SourceFile) {
  if (TEST_MODULE_PATTERN.test(file) || HashSet.has(TOAST_MODULES, file)) {
    return [];
  }
  return Arr.map(
    Arr.flatMap(descendants(sourceFile, false), (node) =>
      isStringLiteralLikeNode(node) &&
      node.text === TOAST_LIBRARY &&
      namesModule(node)
        ? [SONNER_RULE]
        : []
    ),
    (rule) => `${file}: ${rule}.`
  );
}
