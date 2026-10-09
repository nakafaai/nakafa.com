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

/** The four lines of a detached process service: its spawn import, Effect's names, its class, and its layer. */
const SPAWN = 'import { spawn } from "node:child_process";\n';
const EFFECT = 'import { Context, Effect, Layer } from "effect";\n';
const SERVICE =
  'export class Child extends Context.Service<Child, { readonly pid: number }>()("Child") {}\n';
const LAYER =
  'export const ChildLive = Layer.succeed(Child, { pid: Number(spawn("node", [], { detached: true }).pid) });\n';

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

  it.effect("keeps the spawn import of a detached process service", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`${SPAWN}${EFFECT}${SERVICE}${LAYER}`),
        []
      );
      assert.deepStrictEqual(
        yield* findings(`import { spawn, type ChildProcess } from "child_process";
import { Context as C, Layer as L } from "effect";
export class Child extends C.Service<Child, { readonly pid: number }>()("Child") {}
export const ChildLive = L.effect(Child, make(spawn("node", { detached: true })));
`),
        []
      );
    })
  );

  it.effect(
    "reports the process module unless the module provides its own service and starts every child detached",
    () =>
      Effect.gen(function* () {
        const reported = [
          // No layer, the layer of another service, and a call that only names the service.
          `${SPAWN}${EFFECT}${SERVICE}export const child = spawn("node", [], { detached: true });\n`,
          `${SPAWN}${EFFECT}${SERVICE}${LAYER.replace("(Child,", "(Other,")}`,
          `${SPAWN}${EFFECT}${SERVICE}${LAYER.replace("(Child,", "(Wrapper, Child,")}`,
          `${SPAWN}${EFFECT}${SERVICE}${LAYER.replace("Layer.succeed", "Layer.updateService")}`,
          `${SPAWN}${EFFECT}${SERVICE}${LAYER.replace("Layer.succeed", "Other.succeed")}`,
          // Context or Layer that is not Effect's.
          `${SPAWN}import { Context } from "effect";\nimport { Layer } from "@repo/utilities/layer";\n${SERVICE}${LAYER}`,
          `${SPAWN}import { Layer } from "effect";\nimport Context, * as all from "./context";\nimport "./setup";\n${SERVICE}${LAYER}`,
          // Classes that are no service of the module.
          `${SPAWN}${EFFECT}export class Child extends Context.Tag("Child") {}\n${LAYER}`,
          `${SPAWN}${EFFECT}export class Child extends Base implements Runner {}\nclass Plain {}\nexport default class extends Base {}\n${LAYER}`,
          // A child that is not detached, and one of two that is not.
          `${SPAWN}${EFFECT}${SERVICE}${LAYER.replace("detached: true", "detached: false")}`,
          `${SPAWN}${EFFECT}${SERVICE}${LAYER.replace(", { detached: true }", "")}`,
          `${SPAWN}${EFFECT}${SERVICE}${LAYER.replace("{ detached: true }", "options")}`,
          `${SPAWN}${EFFECT}${SERVICE}${LAYER.replace("{ detached: true }", "{ detached, [key]: true, ...rest }")}`,
          `${SPAWN}${EFFECT}${SERVICE}${LAYER}export const second = spawn("node");\n`,
          // An import that binds more than spawn, or binds it another way.
          `import { exec, spawn } from "node:child_process";\n${EFFECT}${SERVICE}${LAYER}`,
          `import { spawn as start } from "node:child_process";\n${EFFECT}${SERVICE}${LAYER}`,
          `import spawn from "node:child_process";\n${EFFECT}${SERVICE}${LAYER}`,
          `import * as spawn from "node:child_process";\n${EFFECT}${SERVICE}${LAYER}`,
          `import "node:child_process";\n${EFFECT}${SERVICE}${LAYER}`,
        ];
        assert.deepStrictEqual(
          yield* Effect.forEach(reported, (source) => findings(source)),
          Arr.map(reported, () => ["1 node-module"])
        );
      })
  );

  it.effect(
    "still reports every other Node module load in a detached process service",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`${SPAWN}${EFFECT}${SERVICE}${LAYER}import { readFileSync } from "node:fs";
import { join } from "node:path";
import cp = require("node:child_process");
export { spawn as run } from "node:child_process";
export const late = require("node:child_process");
export const dynamic = import("node:child_process");
export const builtin = process.getBuiltinModule("node:fs");
export const other = process.getBuiltinModule("node:crypto");
`),
          [
            "5 node-module",
            "6 node-module",
            "7 node-module",
            "8 node-module",
            "9 node-module",
            "10 node-module",
            "11 node-module",
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
