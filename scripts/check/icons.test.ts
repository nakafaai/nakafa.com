import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectIconSource } from "#scripts/check/icons";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";
const WRAPPER = "packages/design-system/components/ui/huge-icons.tsx";

/** The finding for an icon drawn at one utility above size-4. */
const above = (utility: string, file = VIEW) =>
  `${file}: an icon is drawn at ${utility}, above size-4. Every Hugeicons icon is size-4 at most: drop the class, or use size-4 or a smaller step.`;

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
    "rejects an icon whose class, size or parent selector draws it above size-4",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Row() {
  return (
    <div className="[&_svg:not([class*='size-'])]:size-6 [&>svg]:h-5">
      <HugeIcons className="size-5 shrink-0" icon={Add01Icon} />
      <HugeIcons className={cn("sm:w-8", className)} icon={Add01Icon} />
      <HugeIcons icon={Add01Icon} size={20} />
      <HugeIcons icon={Add01Icon}>{label}</HugeIcons>
    </div>
  );
}`),
          [
            above("size-5"),
            above("w-8"),
            above("size={20}"),
            above("size-6"),
            above("h-5"),
          ]
        );
      })
  );

  it.effect(
    "accepts size-4, a smaller step, and a class that sizes nothing",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Row() {
  return (
    <div className="flex size-10 [&_svg]:size-4 [&_svg]:size-3.5 [&_svg]:size-full">
      <HugeIcons className="size-4" icon={Add01Icon} />
      <HugeIcons className="text-muted-foreground" icon={Add01Icon} size={16} />
      <HugeIcons icon={Add01Icon} size={size} />
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
