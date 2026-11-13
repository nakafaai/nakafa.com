import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectIconSource } from "#scripts/check/icons";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";
const WRAPPER = "packages/design-system/components/ui/huge-icons.tsx";

/** The finding for an icon whose own class sizes it. */
const own = (utility: string) =>
  `${VIEW}: an icon sets its own size, ${utility}. HugeIcons draws every icon at size-4: drop the class, and let a design-system part shrink the icons inside it with a selector.`;

/** The finding for a selector that draws icons above size-4. */
const above = (utility: string) =>
  `${VIEW}: a selector draws icons at ${utility}, above size-4. Every Hugeicons icon is size-4 at most: use size-4 or a smaller step.`;

/** The finding for the library's own component drawn outside the wrapper. */
const library = (file = VIEW) =>
  `${file}: an icon is drawn by HugeiconsIcon, which draws 24px. Draw it with HugeIcons from the design system, which draws size-4.`;

/** Inspects one module with the icon policy alone. */
function inspect(sourceText: string, file = VIEW) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectIconSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Icon source policy", () => {
  it.effect(
    "rejects an icon that sizes itself, at any step, and a selector that draws icons above size-4",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Row() {
  return (
    <div className="[&_svg:not([class*='size-'])]:size-6 [&>svg]:h-5">
      <HugeIcons className="size-4 shrink-0" icon={Add01Icon} />
      <HugeIcons className={cn("sm:w-3", className)} icon={Add01Icon} />
      <HugeIcons className="size-2.5" icon={Add01Icon}>{label}</HugeIcons>
    </div>
  );
}`),
          [
            own("size-4"),
            own("w-3"),
            own("size-2.5"),
            above("size-6"),
            above("h-5"),
          ]
        );
      })
  );

  it.effect(
    "accepts an icon without a size and a part that shrinks the icons inside it",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Row() {
  return (
    <div className="flex size-10 [&_svg]:size-4 [&_svg]:size-3.5 [&_svg]:size-full">
      <HugeIcons className="text-muted-foreground shrink-0" icon={Add01Icon} />
      <HugeIcons icon={Add01Icon} />
      <HugeIcons className />
      <a:b className="size-8" />
      <a:b className="size-8">{label}</a:b>
    </div>
  );
}`),
          []
        );
      })
  );

  it.effect(
    "rejects the library's own component outside the design system's wrapper",
    () =>
      Effect.gen(function* () {
        const source =
          "export const Tick = () => <HugeiconsIcon icon={Tick01Icon} />;";
        assert.deepStrictEqual(yield* inspect(source), [library()]);
        assert.deepStrictEqual(yield* inspect(source, WRAPPER), []);
      })
  );

  it.effect("leaves files outside the apps and the packages alone", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(
          `export const Big = () => <HugeIcons className="size-8" icon={Add01Icon} />;`,
          "scripts/check/example.tsx"
        ),
        []
      );
    })
  );
});
