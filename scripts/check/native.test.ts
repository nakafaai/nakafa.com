import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources } from "#scripts/check/source";

const CODE = "apps/www/lib/example.ts";

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

  it.effect("reports Node module re-exports and literal require calls", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`export { readFile } from "node:fs";
export * from "node:path";
export type { Stats } from "node:fs";
export { type Dirent } from "fs";
export * as paths from "node:path";
const { join } = require("node:path");
const config = require(name);
`),
        ["1 node-module", "2 node-module", "5 node-module", "6 node-module"]
      );
    })
  );

  it.effect(
    "reports Node module loads through import assignments and require functions",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import fs = require("node:fs");
import type path = require("node:path");
import url = require(name);
import entity = Module.Member;
export const read = (require)("node:child_process");
export const load = (require as NodeRequire)("node:fs/promises");
export const make = createRequire(import.meta.url)("node:path");
export const member = Module.createRequire(import.meta.url)("node:fs");
export const other = createRequire(import.meta.url)("./local");
export const dynamic = createRequire(import.meta.url)(name);
export const hash = createRequire(import.meta.url)("node:crypto");
export const quiet = run("node:fs");
export const made = Module.makeRequire()("node:fs");
export const named = makeRequire()("node:fs");
`),
          [
            "1 node-module",
            "5 node-module",
            "6 assertion",
            "6 node-module",
            "7 node-module",
            "8 node-module",
          ]
        );
      })
  );

  it.effect(
    "reports a typeof comparison whose typeof operand is parenthesized",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`export const object = (typeof value) === "object";
export const flipped = "object" === (typeof value);
`),
          ["1 typeof-object", "2 typeof-object"]
        );
      })
  );

  it.effect(
    "reports a typeof comparison whose object tag is parenthesized",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`export const object = typeof value === ("object");
export const flipped = ("object") === typeof value;
`),
          ["1 typeof-object", "2 typeof-object"]
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
