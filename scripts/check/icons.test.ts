import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectIconSource } from "#scripts/check/icons";
import { parseSources } from "#scripts/check/source";

const COMPONENT = "apps/www/src/components/example/row.tsx";
const ICON_MODULE = "packages/design-system/components/ui/huge-icons.tsx";
const SIZED =
  'a HugeIcons class sizes the icon. An icon is size-4 at most and takes its size from the size prop alone ("2xs", "xs", "sm", or the default size-4).';
const RENDERER =
  "an icon is drawn with HugeiconsIcon. Draw every icon with HugeIcons, which owns its sizes.";
const DESCENDANT =
  "a class sizes the icons inside an element above size-4. An icon is size-4 at most; a picture that needs more room is drawn artwork.";

/** Inspects one module with the icon policy alone. */
function inspect(sourceText: string, file = COMPONENT) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectIconSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Icon source policy", () => {
  it.effect("refuses a class that sizes HugeIcons, at any size or state", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
const a = <HugeIcons className="size-4" icon={x} />;
const b = <HugeIcons className={cn("text-primary", open && "md:size-6")} icon={x} />;
const c = <HugeIcons className="h-5 w-5" icon={x} />;`),
        [
          `${COMPONENT}: ${SIZED}`,
          `${COMPONENT}: ${SIZED}`,
          `${COMPONENT}: ${SIZED}`,
        ]
      );
    })
  );

  it.effect("accepts a size step and classes that place or color an icon", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
const a = <HugeIcons icon={x} size="xs" />;
const b = <HugeIcons className="text-muted-foreground rtl:rotate-180" icon={x} />;
const c = <HugeIcons icon={x} />;`),
        []
      );
    })
  );

  it.effect("refuses the Hugeicons renderer outside the icon component", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect("const a = <HugeiconsIcon icon={x} />;"),
        [`${COMPONENT}: ${RENDERER}`]
      );
      assert.deepStrictEqual(
        yield* inspect("const a = <HugeiconsIcon icon={x} />;", ICON_MODULE),
        []
      );
    })
  );

  it.effect(
    "refuses a class that sizes the icons inside an element above size-4",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
const a = <div className="[&_svg]:size-5" />;
const b = <div className="[&_svg:not([class*='size-'])]:size-4 *:[svg]:size-3.5" />;`),
          [`${COMPONENT}: ${DESCENDANT}`]
        );
      })
  );

  it.effect("leaves tests and plain modules alone", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(
          '<HugeIcons className="size-6" icon={x} />;',
          "apps/www/src/components/example/row.test.tsx"
        ),
        []
      );
      assert.deepStrictEqual(
        yield* inspect(
          'export const big = "[&_svg]:size-8";',
          "apps/www/src/lib/look.ts"
        ),
        []
      );
    })
  );
});
