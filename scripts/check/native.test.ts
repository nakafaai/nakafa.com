import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources } from "#scripts/check/source";

const CODE = "apps/www/lib/example.ts";
const SCRIPT = "scripts/tool.ts";

/** Lists the Effect-native findings of one module as `line rule`. */
const findings = Effect.fn("NativePolicyTest.findings")(function* (
  sourceText: string,
  file = CODE
) {
  const found = yield* effectFindings(
    yield* parseSources([{ file, sourceText }])
  );
  return Arr.map(found, ({ line, rule }) => `${line} ${rule}`);
}, Effect.scoped);

describe("native syntax", () => {
  it.effect("reports array methods on values in strict modules", () =>
    Effect.gen(function* () {
      const source = `import { Array as Arr } from "effect";
const items = [1];
items.map(String);
Arr.map(items, String);
make().filter(Boolean);
parts.join(", ");
path.join(root, file);
text.slice(1);
items.push(2);
items.find(Boolean);
items["map"](String);
items[name](String);
run();
`;
      assert.deepStrictEqual(yield* findings(source, SCRIPT), [
        "3 array-method",
        "5 array-method",
        "6 array-method",
        "10 array-search",
        "11 array-method",
      ]);
      assert.deepStrictEqual(yield* findings(source), []);
    })
  );

  it.effect(
    "reports array methods on values imported from repository modules",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(
            `import { Chunk } from "some-package";
import { rows, other as renamed } from "#scripts/data";
import list from "./list";
import * as space from "./space";
import type { Shape } from "@repo/backend/shape";
import "./setup";
rows.map(String);
renamed.filter(Boolean);
list.find(Boolean);
space.map(String);
Chunk.map(String);
function local(rows: Shape) {
  return rows.map(String);
}
`,
            SCRIPT
          ),
          [
            "7 array-method",
            "8 array-method",
            "9 array-search",
            "13 array-method",
          ]
        );
      })
  );

  it.effect("reports raw failure handling and typeof-object narrowing", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`export function read(value: unknown) {
  try {
    run();
  } catch {
    return typeof value === "object";
  }
  try {
    run();
  } finally {
    stop();
  }
  return "object" !== typeof value || typeof value === "string" || typeof value === typeof other || value === "object";
}
`),
        ["2 try-catch", "5 typeof-object", "12 typeof-object"]
      );
    })
  );
});
