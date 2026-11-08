import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectPickerSource } from "#scripts/check/pickers";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";
const RAW =
  "imports the raw autocomplete of @repo/design-system/components/ui/autocomplete. A searchable choice is a Picker, which draws its search, its label, its options and its empty sentence on every screen.";
const OWN_EMPTY = `${VIEW}: a PickerContent writes its own empty sentence. Read it from a key of the empty family, which holds one sentence, such as empty={t("locale-empty")}.`;

/** Inspects one module with the picker policy alone. */
function inspect(sourceText: string, file = VIEW) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectPickerSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

/** What the policy says of a command list put in `surface` by hand. */
function commandIn(surface: string) {
  return `${VIEW}: puts the command list of @repo/design-system/components/ui/command in @repo/design-system/components/ui/${surface}. A searchable choice is a Picker, which opens as a popover on a wide screen and as a drawer on a phone.`;
}

describe("Picker source policy", () => {
  it.effect("rejects a module that imports the raw autocomplete", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
import { Autocomplete } from "@repo/design-system/components/ui/autocomplete";
import "./side-effect";
export const value = 1;`),
        [`${VIEW}: ${RAW}`]
      );
    })
  );

  it.effect(
    "rejects a command list in a popover, a drawer, a sheet or a dialog",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
import { Command } from "@repo/design-system/components/ui/command";
import { Popover } from "@repo/design-system/components/ui/popover";
import { Drawer } from "@repo/design-system/components/ui/drawer";
import { Sheet } from "@repo/design-system/components/ui/sheet";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
export const value = 1;`),
          [
            commandIn("popover"),
            commandIn("drawer"),
            commandIn("sheet"),
            commandIn("responsive-dialog"),
          ]
        );
      })
  );

  it.effect(
    "leaves a command palette, a lone popover and the primitives alone",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
import { CommandDialogPopup } from "@repo/design-system/components/ui/command";
export const value = 1;`),
          []
        );
        assert.deepStrictEqual(
          yield* inspect(`
import { Popover } from "@repo/design-system/components/ui/popover";
export const value = 1;`),
          []
        );
        assert.deepStrictEqual(
          yield* inspect(
            `
import { Autocomplete } from "@repo/design-system/components/ui/autocomplete";
import { Popover } from "@repo/design-system/components/ui/popover";
export function Picker() {
  return <PickerContent empty="Nothing" />;
}`,
            "packages/design-system/components/ui/picker.tsx"
          ),
          []
        );
      })
  );

  it.effect(
    "rejects a picker whose empty sentence is text of its own, in either branch of a choice",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Choice() {
  return (
    <>
      <PickerContent empty="Nothing here." />
      <PickerContent empty={\`Nothing\`} />
      <PickerContent empty={t("no-results")} />
      <PickerContent empty={t(key)} />
      <PickerContent empty={t()} />
      <PickerContent empty={typed === "" ? t("people-empty") : (t("no-results"))} />
      <PickerContent empty={typed === "" ? "None" : t("search-empty")} />
    </>
  );
}`),
          [
            OWN_EMPTY,
            OWN_EMPTY,
            OWN_EMPTY,
            OWN_EMPTY,
            OWN_EMPTY,
            OWN_EMPTY,
            OWN_EMPTY,
          ]
        );
      })
  );

  it.effect(
    "accepts an empty sentence read from the empty family, and one the component receives",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Choice({ empty }: { empty: string }) {
  return (
    <>
      <PickerContent empty={t("locale-empty")} />
      <PickerContent empty={t("Common.search-empty")} />
      <PickerContent empty={t("empty")} />
      <PickerContent empty={typed === "" ? t("people-empty") : t("search-empty")} />
      <PickerContent empty={empty} />
      <PickerContent empty={labels.empty} />
      <PickerContent empty={} />
      <PickerContent empty />
      <PickerContent {...props} />
      <Other empty="Free" />
    </>
  );
}`),
          []
        );
      })
  );

  it.effect("reads no element of a module without JSX", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(
          'export const empty = "<PickerContent empty=\\"x\\" />";',
          "apps/www/src/lib/example.ts"
        ),
        []
      );
    })
  );
});
