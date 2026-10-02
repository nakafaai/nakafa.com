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
`;
      assert.deepStrictEqual(yield* findings(source, SCRIPT), [
        "3 array-method",
        "5 array-method",
        "6 array-method",
        "9 array-method",
      ]);
      assert.deepStrictEqual(yield* findings(source), []);
    })
  );

  it.effect("reports Promise syntax in strict domain modules", () =>
    Effect.gen(function* () {
      const source = `export async function load() {
  await run();
}
for await (const chunk of stream) {
  use(chunk);
}
export const later = new Promise(start);
export const handler = { async run() {} };
export const arrow = async () => 1;
`;
      assert.deepStrictEqual(yield* findings(source, SCRIPT), [
        "1 promise",
        "2 promise",
        "4 promise",
        "7 promise",
        "8 promise",
        "9 promise",
      ]);
      assert.deepStrictEqual(yield* findings(source), []);
    })
  );

  it.effect(
    "reports runtime imports of Node file, path, and process modules",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { readFile } from "node:fs";
import path from "path";
import "node:child_process";
import type { Stats } from "node:fs";
import { type Dirent } from "fs";
import { join, type ParsedPath } from "node:path";
import { createHash } from "node:crypto";
export const spawn = import("child_process");
export const crypto = import("node:crypto");
export const dynamic = import(name);
`),
          [
            "1 node-module",
            "2 node-module",
            "3 node-module",
            "6 node-module",
            "8 node-module",
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
