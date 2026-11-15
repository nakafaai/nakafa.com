import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectScrollSource } from "#scripts/check/scroll";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";
const SHEET = "packages/design-system/components/ui/sheet.tsx";
const FIX =
  'lets an overlay scroll sideways. A dialog, a sheet or a drawer scrolls only downwards: give its ScrollArea axis="vertical", and wrap, truncate or stack what it holds.';

/** Inspects one module with the overlay scroll policy alone. */
function inspect(sourceText: string, file = VIEW) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectScrollSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Overlay scroll source policy", () => {
  it.effect("rejects what scrolls sideways inside an overlay", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
export function Poll() {
  return (
    <ResponsiveDialog title={t("poll")}>
      <ScrollArea>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <div className="flex md:overflow-x-auto" />
      <div className={cn("grid", "overflow-scroll")} />
    </ResponsiveDialog>
  );
}`),
        [
          `${VIEW}:5: a ScrollArea without axis="vertical" ${FIX}`,
          `${VIEW}:6: a horizontal ScrollBar ${FIX}`,
          `${VIEW}:8: overflow-x-auto ${FIX}`,
          `${VIEW}:9: overflow-scroll ${FIX}`,
        ]
      );
    })
  );

  it.effect(
    "accepts what scrolls downwards in an overlay, and what scrolls outside one",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Poll() {
  return (
    <>
      <SheetContent>
        <ScrollArea axis="vertical">
          <ScrollBar orientation="vertical" />
          <ScrollBar />
        </ScrollArea>
        <div className="overflow-y-auto overflow-x-hidden" />
        <div className={overflow} />
      </SheetContent>
      <div className="overflow-x-auto" />
      <ScrollArea />
    </>
  );
}`),
          []
        );
        assert.deepStrictEqual(
          yield* inspect(
            "export const area = <SheetContent><ScrollArea /></SheetContent>;",
            "apps/www/src/components/example.ts"
          ),
          []
        );
      })
  );

  it.effect(
    "requires a vertical axis of every ScrollArea in the design system's overlays",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(
            `
function SheetPanel(props) {
  return (
    <ScrollArea className="min-h-0 flex-1" scrollFade>
      <div {...props} />
    </ScrollArea>
  );
}
function SheetList(props) {
  return <ScrollArea axis="vertical" {...props} />;
}`,
            SHEET
          ),
          [`${SHEET}:4: a ScrollArea without axis="vertical" ${FIX}`]
        );
      })
  );
});
