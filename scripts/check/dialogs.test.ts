import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectDialogSource } from "#scripts/check/dialogs";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";

/** Inspects one module with the dialog policy alone. */
function inspect(sourceText: string, file = VIEW) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectDialogSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Dialog source policy", () => {
  it.effect(
    "rejects an application module that imports the raw dialog parts",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
import { DialogContent } from "@repo/design-system/components/ui/dialog";
import { AlertDialog } from "@repo/design-system/components/ui/alert-dialog";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Drawer } from "@repo/design-system/components/ui/drawer";
export const value = 1;`),
          [
            `${VIEW}: a dialog is built from the raw parts of @repo/design-system/components/ui/dialog. Show it through ResponsiveDialog, which draws its header, its close, its body and its footer.`,
            `${VIEW}: a dialog is built from the raw parts of @repo/design-system/components/ui/alert-dialog. Show it through ResponsiveDialog, which draws its header, its close, its body and its footer.`,
          ]
        );
      })
  );

  it.effect("leaves the design system that composes them alone", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(
          'import { DialogContent } from "@repo/design-system/components/ui/dialog";',
          "packages/design-system/components/ui/responsive-dialog.tsx"
        ),
        []
      );
    })
  );
});
