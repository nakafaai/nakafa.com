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

/** The import of a platform HTTP server, and a module that serves with it. */
const NODE_HTTP = 'import { createServer } from "node:http";\n';
const PLATFORM = 'import { NodeHttpServer } from "@effect/platform-node";\n';
const SERVE =
  "export const server = NodeHttpServer.make(createServer, { port: 0 });\n";

/** The import of Node's synchronous signing, and the module's calls of it. */
const NODE_SIGN = 'import { generateKeyPairSync, sign } from "node:crypto";\n';
const SIGNING =
  'export const keys = generateKeyPairSync("ed25519");\nexport const signature = sign(null, bytes, keys.privateKey);\n';

describe("native syntax", () => {
  it.effect(
    "reports runtime imports of the Node modules that Effect and the platform replace",
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
import { Buffer } from "node:buffer";
import { parseEnv } from "node:util";
import { availableParallelism } from "node:os";
import { createServer } from "node:net";
import { request } from "http";
import { readFile as read } from "node:fs/promises";
import { isDeepStrictEqual } from "util/types";
import { Buffer as Polyfill } from "buffer/";
import { fileURLToPath } from "node:url";
import { lookup } from "node:dns/promises";
import { createRequire } from "node:module";
export const spawn = import("child_process");
export const hash = import("node:crypto");
export const dynamic = import(name);
`),
          [
            "1 node-module",
            "2 node-module",
            "3 node-module",
            "6 node-module",
            "7 node-module",
            "8 node-module",
            "9 node-module",
            "10 node-module",
            "11 node-module",
            "12 node-module",
            "13 node-module",
            "14 node-module",
            "15 node-module",
            "19 node-module",
            "20 node-module",
          ]
        );
      })
  );

  it.effect(
    "names a Node module by its name, so look-alike packages and paths stay",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { copy } from "fs-extra";
import { posix } from "pathe";
import CryptoJs from "crypto-js";
import { createHash } from "@scope/crypto";
import { get } from "./fs";
import { util } from "../util/index";
import { net } from "@repo/net";
import { os } from "os-name";
`),
          []
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
          // A child started through an alias of spawn.
          `${SPAWN}${EFFECT}${SERVICE}${LAYER}export const start = spawn;\nexport const second = start("node");\n`,
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
            "12 node-module",
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
            "11 node-module",
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

  it.effect("keeps the createServer import of a platform HTTP server", () =>
    Effect.gen(function* () {
      for (const source of [
        `${NODE_HTTP}${PLATFORM}${SERVE}`,
        // Each function that takes the constructor, the bare specifier, and a
        // renamed platform server.
        `${NODE_HTTP}${PLATFORM}${SERVE.replace("make", "layer")}`,
        `${NODE_HTTP}${PLATFORM}${SERVE.replace("make", "layerConfig")}`,
        `${NODE_HTTP}${PLATFORM}${SERVE.replace("make", "layerServer")}`,
        `${NODE_HTTP.replace("node:http", "http")}${PLATFORM}${SERVE}`,
        `${NODE_HTTP}import { NodeHttpServer as Serve } from "@effect/platform-node";\nexport const server = Serve.make(createServer, { port: 0 });\n`,
        // A type next to the constructor, a member of the same name that is no
        // read of the import, and several servers.
        `import { createServer, type Server } from "node:http";\n${PLATFORM}${SERVE}`,
        `${NODE_HTTP}${PLATFORM}${SERVE}export const other = factory.createServer;\n`,
        `${NODE_HTTP}${PLATFORM}${SERVE}${SERVE.replace("server", "second")}`,
      ]) {
        assert.deepStrictEqual(yield* findings(source), []);
      }
    })
  );

  it.effect(
    "reports the http module unless a platform server takes every createServer",
    () =>
      Effect.gen(function* () {
        const reported = [
          // No platform server import, or one from another package.
          `${NODE_HTTP}${SERVE}`,
          `${NODE_HTTP}import { NodeHttpServer } from "./server";\n${SERVE}`,
          `${NODE_HTTP}import NodeHttpServer from "@effect/platform-node";\n${SERVE}`,
          // No read, a read that is no first argument, a read in a call of
          // another function, and one good read next to a bad one.
          `${NODE_HTTP}${PLATFORM}`,
          `${NODE_HTTP}${PLATFORM}export const raw = createServer();\n`,
          `${NODE_HTTP}${PLATFORM}${SERVE.replace("createServer, { port: 0 }", "{ port: 0 }, createServer")}`,
          `${NODE_HTTP}${PLATFORM}${SERVE.replace("make", "layerTest")}`,
          `${NODE_HTTP}${PLATFORM}${SERVE.replace("NodeHttpServer", "Other")}`,
          `${NODE_HTTP}${PLATFORM}${SERVE}export const raw = createServer();\n`,
          `${NODE_HTTP}${PLATFORM}${SERVE}export const alias = createServer;\n`,
          // An import that binds more than createServer, or binds it another way.
          `import { createServer, request } from "node:http";\n${PLATFORM}${SERVE}`,
          `import { createServer as make } from "node:http";\n${PLATFORM}export const server = NodeHttpServer.make(make, { port: 0 });\n`,
          `import http from "node:http";\n${PLATFORM}${SERVE}`,
          `import * as http from "node:http";\n${PLATFORM}${SERVE}`,
          `import "node:http";\n${PLATFORM}${SERVE}`,
        ];
        assert.deepStrictEqual(
          yield* Effect.forEach(reported, (source) => findings(source)),
          Arr.map(reported, () => ["1 node-module"])
        );
      })
  );

  it.effect(
    "keeps the signing imports of a fixture that signs with Ed25519",
    () =>
      Effect.gen(function* () {
        for (const source of [
          `${NODE_SIGN}${SIGNING}`,
          // The bare specifier, renamed bindings, a type next to them, and one of
          // the two bound with calls of it only.
          `${NODE_SIGN.replace("node:crypto", "crypto")}${SIGNING}`,
          `import { generateKeyPairSync as generate, sign as signBytes } from "node:crypto";\nexport const keys = generate("ed25519");\nexport const signature = signBytes(null, bytes, keys.privateKey);\n`,
          `import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";\n${SIGNING}`,
          `import { sign } from "node:crypto";\nexport const signature = sign(null, bytes, key);\n`,
          `${NODE_SIGN}${SIGNING}${SIGNING.replaceAll("keys", "more").replace("signature", "again")}`,
          // A member of the same name on another object is no read of the import.
          `${NODE_SIGN}${SIGNING}export const other = factory.sign;\nexport const pair = factory.generateKeyPairSync("rsa");\n`,
        ]) {
          assert.deepStrictEqual(yield* findings(source), []);
        }
      })
  );

  it.effect(
    "reports the crypto module unless a fixture only signs with Ed25519",
    () =>
      Effect.gen(function* () {
        const reported = [
          // Other key types and a digest, which Web Crypto does asynchronously.
          `${NODE_SIGN}${SIGNING.replace("ed25519", "rsa")}`,
          `${NODE_SIGN}${SIGNING.replace("null", '"sha256"')}`,
          `${NODE_SIGN}${SIGNING.replace('"ed25519"', "type")}`,
          `${NODE_SIGN}${SIGNING.replace("null, ", "")}`,
          // No call, or one bad call among good ones.
          `${NODE_SIGN}export const keys = {};\n`,
          `${NODE_SIGN}${SIGNING}export const more = generateKeyPairSync("rsa");\n`,
          `${NODE_SIGN}${SIGNING}export const more = sign("sha256", bytes, key);\n`,
          // A function that is read and not called with the argument that is
          // allowed: through an alias, a method, a handover, or a re-export,
          // also under the local name of a renamed import.
          `${NODE_SIGN}${SIGNING}export const digest = sign;\nexport const signed = digest("sha256", bytes, key);\n`,
          `${NODE_SIGN}${SIGNING}export const signed = sign.call(null, "sha256", bytes, key);\n`,
          `${NODE_SIGN}${SIGNING}export const signed = Reflect.apply(sign, null, ["sha256", bytes, key]);\n`,
          `${NODE_SIGN}${SIGNING}export const make = generateKeyPairSync;\nexport const pair = make("rsa", { modulusLength: 2048 });\n`,
          `${NODE_SIGN}${SIGNING}export const wrapped = wrap(null, sign);\n`,
          `${NODE_SIGN}${SIGNING}export { generateKeyPairSync };\n`,
          `import { generateKeyPairSync as generate, sign as signBytes } from "node:crypto";\nexport const keys = generate("ed25519");\nexport const make = generate;\nexport const signature = signBytes(null, bytes, keys.privateKey);\n`,
          // An import that binds more than the two, or binds them another way.
          `import { createHash, generateKeyPairSync, sign } from "node:crypto";\n${SIGNING}`,
          `import { generateKeyPairSync, sign, verify } from "node:crypto";\n${SIGNING}`,
          `import crypto from "node:crypto";\nexport const keys = crypto.generateKeyPairSync("ed25519");\n`,
          `import * as crypto from "node:crypto";\nexport const keys = crypto.generateKeyPairSync("ed25519");\n`,
          `import "node:crypto";\n${SIGNING}`,
        ];
        assert.deepStrictEqual(
          yield* Effect.forEach(reported, (source) => findings(source)),
          Arr.map(reported, () => ["1 node-module"])
        );
      })
  );
});
