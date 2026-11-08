import { Array as Arr, HashSet, Result } from "effect";
import {
  isImportDeclaration,
  isStringLiteral,
  type SourceFile,
} from "tsrs/ast";

/** The application code, which shows a dialog through the design system's ResponsiveDialog alone. */
const APPLICATION_PATTERN = /^apps\//u;
/** The raw parts of a dialog, which only the design system composes. */
const DIALOG_MODULES = HashSet.make(
  "@repo/design-system/components/ui/dialog",
  "@repo/design-system/components/ui/alert-dialog"
);

/**
 * Reports an application module that builds a dialog from its raw parts. ResponsiveDialog draws every dialog's
 * header with its title and the close in the corner, requires its body, and draws its footer with Cancel beside the
 * action, so a dialog built from those parts directly could leave any of them out.
 */
export function inspectDialogSource(file: string, sourceFile: SourceFile) {
  if (!APPLICATION_PATTERN.test(file)) {
    return [];
  }
  return Arr.filterMap(sourceFile.statements, (statement) =>
    isImportDeclaration(statement) &&
    isStringLiteral(statement.moduleSpecifier) &&
    HashSet.has(DIALOG_MODULES, statement.moduleSpecifier.text)
      ? Result.succeed(
          `${file}: a dialog is built from the raw parts of ${statement.moduleSpecifier.text}. Show it through ResponsiveDialog, which draws its header, its close, its body and its footer.`
        )
      : Result.failVoid
  );
}
