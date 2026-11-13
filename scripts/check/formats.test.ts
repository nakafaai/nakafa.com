import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, Order } from "effect";
import { inspectFormatSource } from "#scripts/check/formats";
import { parseSources } from "#scripts/check/source";

const COMPONENT = "apps/www/src/components/example/row.tsx";
const BUILD_RULE =
  "write it with useFormatter or formatterOf and a FORMATS name from @repo/internationalization/src/formats, or a price with formatCurrency from @repo/internationalization/src/money, instead of building an Intl formatter";
const NAME_RULE =
  "name a format of FORMATS from @repo/internationalization/src/formats as the second argument instead of writing its options, and pass an override such as a time zone third";

/** Inspects one module with the format policy alone, its findings in line order. */
function inspect(sourceText: string, file = COMPONENT) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.sort(
        Arr.flatMap(modules, (parsed) =>
          inspectFormatSource(parsed.file, parsed.sourceFile)
        ),
        Order.String
      )
    )
  );
}

describe("Format source policy", () => {
  it.effect(
    "rejects a platform formatter built outside the locale module",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
const day = new Intl.DateTimeFormat("en", { dateStyle: "long" });
const count = Intl.NumberFormat("en").format(3);
const ago = new Intl.RelativeTimeFormat("en");
const items = new Intl.ListFormat("en");
const plural = new Intl.PluralRules("en");`),
          [
            `${COMPONENT}:2: ${BUILD_RULE}.`,
            `${COMPONENT}:3: ${BUILD_RULE}.`,
            `${COMPONENT}:4: ${BUILD_RULE}.`,
            `${COMPONENT}:5: ${BUILD_RULE}.`,
            `${COMPONENT}:6: ${BUILD_RULE}.`,
          ]
        );
      })
  );

  it.effect("rejects the options of a format written at a call", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
const format = useFormatter();
format.dateTime(at, { dateStyle: "medium" });
formatterOf(locale).number(3, { maximumFractionDigits: 2 });
format.list(names, { type: "conjunction" });`),
        [
          `${COMPONENT}:3: ${NAME_RULE}.`,
          `${COMPONENT}:4: ${NAME_RULE}.`,
          `${COMPONENT}:5: ${NAME_RULE}.`,
        ]
      );
    })
  );

  it.effect(
    "accepts a named format with an override, a default number, a table column, and a read of the viewer's zone",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
const format = useFormatter();
const columns = tableColumns<Row>();
format.dateTime(at, "dateTime", { timeZone });
columns.number((row) => row.points, { header: "Points", id: "points" });
format.number(3);
formatterOf(locale).list(prices, "or");
format.relativeTime(at, { now, unit: "day" });
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const names = new Intl.DisplayNames(["en"], { type: "currency" });`),
          []
        );
      })
  );

  it.effect("accepts the locale module, tests and Playwright specs", () =>
    Effect.gen(function* () {
      const source = `const day = new Intl.DateTimeFormat("en");`;

      assert.deepStrictEqual(
        yield* inspect(source, "packages/internationalization/src/formats.ts"),
        []
      );
      assert.deepStrictEqual(
        yield* inspect(source, "packages/internationalization/src/money.ts"),
        []
      );
      assert.deepStrictEqual(
        yield* inspect(source, "apps/www/src/components/example/row.test.ts"),
        []
      );
      assert.deepStrictEqual(
        yield* inspect(source, "apps/www/e2e/example/row.browser.ts"),
        []
      );
    })
  );
});
