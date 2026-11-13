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

  it.effect(
    "rejects a dialog whose footer repeats its close with Cancel, Close or a press that only closes",
    () =>
      Effect.gen(function* () {
        const repeated = `${VIEW}: a dialog's footer repeats its close with Cancel or Close. The close in the corner, a swipe or a press outside already leave: pass only the dialog's own actions.`;
        assert.deepStrictEqual(
          yield* inspect(`
export function Confirm() {
  return (
    <>
      <ResponsiveDialog action={<Button>{common("cancel")}</Button>} open={open} setOpen={setOpen} />
      <ResponsiveDialog action={<Button onClick={() => setOpen(false)}>{t("done")}</Button>} setOpen={setOpen}>
        {body}
      </ResponsiveDialog>
      <ResponsiveDialog
        action={<Button onClick={() => { setOpen(false); }}>{t("done")}</Button>}
        setOpen={setOpen}
      />
    </>
  );
}`),
          [repeated, repeated, repeated]
        );
      })
  );

  it.effect(
    "accepts a dialog whose footer holds its own actions, a press that acts and then closes included",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Confirm() {
  return (
    <>
      <ResponsiveDialog
        action={<Button onClick={() => { save(); setOpen(false); }}>{t("save")}</Button>}
        setOpen={setOpen}
      />
      <ResponsiveDialog action={<Button onClick={() => {}}>{t("save")}</Button>} setOpen={setOpen} />
      <ResponsiveDialog action={<Button onClick={() => { return; }}>{t("save")}</Button>} setOpen={setOpen} />
      <ResponsiveDialog action={<Button onClick={() => close(false)}>{t()}</Button>} setOpen={setOpen} />
      <ResponsiveDialog action={<Button onClick={() => dialog.close()}>{t(key)}</Button>} setOpen={(next) => setOpen(next)} />
      <ResponsiveDialog action setOpen={setOpen} />
      <ResponsiveDialog setOpen={setOpen}>{body}</ResponsiveDialog>
      <Dialog action={<Button>{common("cancel")}</Button>} />
      <Dialog>{common("cancel")}</Dialog>
    </>
  );
}`),
          []
        );
      })
  );
});
