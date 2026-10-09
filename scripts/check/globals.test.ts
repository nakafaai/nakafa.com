import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources } from "#scripts/check/source";

const CODE = "apps/www/lib/example.ts";

/** Lists the Effect-native findings of one module as `line rule`. */
const findings = Effect.fn("GlobalPolicyTest.findings")(function* (
  sourceText: string,
  file = CODE
) {
  const found = yield* effectFindings(
    yield* parseSources([{ file, sourceText }])
  );
  return Arr.map(found, ({ line, rule }) => `${line} ${rule}`);
}, Effect.scoped);

describe("platform globals", () => {
  it.effect("reports each platform global an Effect module replaces", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`new Map();
new Set();
Object.keys(value);
Object.entries(value);
Object.values(value);
Object.fromEntries(value);
Array.isArray(value);
JSON.parse(text);
JSON.stringify(value);
fetch(url);
process.env.SECRET;
Date.now();
new Date();
new Date;
Math.random();
setTimeout(run, 1);
setInterval(run, 1);
console.log(value);
class Failure extends Error {}
const Rejection = class extends TypeError {};
globalThis.fetch(url);
window.setTimeout(run, 1);
self.console.info(value);
`),
        [
          "1 map-set",
          "2 map-set",
          "3 object-helper",
          "4 object-helper",
          "5 object-helper",
          "6 object-helper",
          "7 array-check",
          "8 json",
          "9 json",
          "10 fetch",
          "11 env",
          "12 clock",
          "13 clock",
          "14 clock",
          "15 random",
          "16 timer",
          "17 timer",
          "18 console",
          "19 error-class",
          "20 error-class",
          "21 fetch",
          "22 timer",
          "23 console",
        ]
      );
    })
  );

  it.effect("reads Object and Array members through global objects", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`Object.keys(value);
Object.entries(value);
Object.values(value);
Object.fromEntries(value);
Array.isArray(value);
globalThis.Object.keys(value);
window.Array.isArray(value);
self.Object.values(value);
Object["keys"](value);
Array['isArray'](value);
globalThis.Object["values"](value);
globalThis["Object"].entries(value);
(Object).keys(value);
(globalThis.Object).values(value);
Object!.keys(value);
(Array as typeof Array).isArray(value);
(globalThis).Object.keys(value);
(Object satisfies unknown).keys(value);
global.Object.keys(value);
global.Array.isArray(value);
const { keys } = Object;
const { isArray: check, from } = Array;
const { values: read } = globalThis.Object;
const { "entries": list } = (Object);
`),
        [
          "1 object-helper",
          "2 object-helper",
          "3 object-helper",
          "4 object-helper",
          "5 array-check",
          "6 object-helper",
          "7 array-check",
          "8 object-helper",
          "9 object-helper",
          "10 array-check",
          "11 object-helper",
          "12 object-helper",
          "13 object-helper",
          "14 object-helper",
          "15 assertion",
          "15 object-helper",
          "16 array-check",
          "16 assertion",
          "17 object-helper",
          "18 assertion",
          "18 object-helper",
          "19 object-helper",
          "20 array-check",
          "21 object-helper",
          "22 array-check",
          "23 object-helper",
          "24 object-helper",
        ]
      );
    })
  );

  it.effect("reads platform globals inside an extends call", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`declare function makeBase<T>(value: T): new () => object;
export class Holder extends makeBase(JSON.parse(text)) {}
`),
        ["2 json"]
      );
    })
  );

  it.effect(
    "reports a class that extends a global error through a wrapper or a global object",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`export class Failure extends globalThis.Error {}
export class Parenthesized extends (Error) {}
export class Asserted extends (TypeError as ErrorConstructor) {}
export class Satisfied extends (RangeError satisfies ErrorConstructor) {}
export class Negated extends RangeError! {}
export class Named extends window["SyntaxError"] {}
export class Member extends self.URIError {}
`),
          [
            "1 error-class",
            "2 error-class",
            "3 assertion",
            "3 error-class",
            "4 assertion",
            "4 error-class",
            "5 assertion",
            "5 error-class",
            "6 error-class",
            "7 error-class",
          ]
        );
      })
  );

  it.effect("ignores a heritage member that names no global error class", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`export class Client extends client.Error {}
export class Built extends make().Error {}
export class Mapped extends globalThis.Map {}
export class Dynamic extends window[name] {}
`),
        []
      );
    })
  );

  it.effect(
    "ignores a global error class that a local global object shadows",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`const window = { Error: class {} };
export class Local extends window.Error {}
`),
          []
        );
      })
  );

  it.effect(
    "reports crypto.randomUUID through each name of the crypto global",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`crypto.randomUUID();
globalThis.crypto.randomUUID();
window.crypto.randomUUID();
self.crypto.randomUUID();
`),
          ["1 random", "2 random", "3 random", "4 random"]
        );
      })
  );

  it.effect("keeps crypto.subtle and crypto.getRandomValues allowed", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`crypto.getRandomValues(bytes);
crypto.subtle.digest("SHA-256", bytes);
`),
        []
      );
    })
  );

  it.effect(
    "leaves a crypto.randomUUID read through a local crypto binding alone",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(
            `import { Crypto, Effect } from "effect";
export const randomUuid = Effect.gen(function* () {
  const crypto = yield* Crypto.Crypto;
  return yield* crypto.randomUUID;
});
`,
            "packages/utilities/uuid.ts"
          ),
          []
        );
      })
  );

  it.effect(
    "reads crypto.randomUUID only where no local binding shadows crypto",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* findings("crypto.randomUUID();\n"), [
          "1 random",
        ]);
        assert.deepStrictEqual(
          yield* findings(`const crypto = { randomUUID: () => "id" };
export const id = crypto.randomUUID();
`),
          []
        );
      })
  );

  it.effect("reports setImmediate, queueMicrotask, and a bare Date call", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`setImmediate(run);
queueMicrotask(run);
const now = Date();
const stamp = new Date(0);
`),
        ["1 timer", "2 timer", "3 clock"]
      );
    })
  );

  it.effect("ignores other members, shadowed names, and lookalikes", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`import { Array as Arr, Option } from "effect";
const Map = Option.some;
new Map(1);
new Date(0);
Date.parse(text);
Object.assign(target, source);
Math.max(1, 2);
Array.from(items);
JSON;
client.fetch(url);
fetch;
console;
Promise.resolve(value);
Map(1);
class Failure extends Base {}
interface Rejection extends Error {}
function read(process: Source) {
  return process.env.SECRET;
}
`),
        []
      );
    })
  );

  it.effect(
    "ignores shadowed Object and Array names and unrelated members",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { Array as Arr, Record } from "effect";
const Object = Record;
Object.keys(value);
Arr.isArray(value);
Array.from(items);
Array;
Math.max(1, 2);
client.Object.keys(value);
globalThis.Math.max(1, 2);
globalThis.Array.from(items);
globalThis.Array;
Object[name](value);
const { [name]: dynamic, ...rest } = Object;
const { max } = Math;
const [first] = Object;
const copy = Object;
globalThis[name].keys(value);
globalThis["Math"].max(1, 2);
client["Object"].keys(value);
function read(Array: Source) {
  return Array.isArray(value);
}
`),
          []
        );
      })
  );

  it.effect(
    "leaves platform globals inside a function that the browser page runs",
    () =>
      Effect.gen(function* () {
        const e2e = "apps/www/e2e/page.browser.ts";
        assert.deepStrictEqual(
          yield* findings(
            `import { test } from "@playwright/test";
page.evaluate(() => new Map(Object.entries(window.state)));
page.addInitScript(() => {
  JSON.parse(window.name);
  setTimeout(run, Date.now());
});
page.$eval("main", (node) => new Set(Object.keys(node.dataset)));
function countFrames() {
  return new Map(Object.values(window.frames));
}
page.evaluate(countFrames);
const cache = new Map();
Object.keys(routes);
`,
            e2e
          ),
          ["12 map-set", "13 object-helper"]
        );
        assert.deepStrictEqual(
          yield* findings(
            `page.evaluate(() => new Map(Object.entries(window.state)));
page.addInitScript(() => {
  JSON.parse(window.name);
  setTimeout(run, Date.now());
});
`,
            "apps/www/lib/page.ts"
          ),
          ["1 map-set", "1 object-helper", "3 json", "4 clock", "4 timer"]
        );
      })
  );
});

describe("environment reads", () => {
  it.effect("keeps writes, build constants, and the readEnvironment seam", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`import { readEnvironment } from "@repo/utilities/env";
process.env.NODE_ENV === "production";
process.env.NEXT_RUNTIME === "nodejs";
process.env.SITE_URL = "https://nakafa.com";
process.env.SITE_URL ??= "https://nakafa.com";
delete process.env.SITE_URL;
export const env = readEnvironment(fields, {
  PREVIEW: process.env.PREVIEW,
  SITE_URL: process.env.SITE_URL,
});
`),
        []
      );
    })
  );

  it.effect("reports every read outside those seams", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`import { readEnvironment } from "@repo/utilities/env";
const url = process.env.SITE_URL;
const name = process.env[key];
const inherited = { ...process.env };
const record = { SITE_URL: process.env.SITE_URL };
const local = makeEnv(fields, { SITE_URL: process.env.SITE_URL });
const whole = readEnvironment(fields, process.env);
const renamed = readEnvironment(fields, { URL: process.env.SITE_URL });
const computed = readEnvironment(fields, { SITE_URL: process.env["SITE_URL"] });
const quoted = readEnvironment(fields, { "SITE_URL": process.env.SITE_URL });
const first = readEnvironment({ SITE_URL: process.env.SITE_URL }, {});
const fallback = readEnvironment(fields, { SITE_URL: process.env.SITE_URL ?? "" });
const member = Env.readEnvironment(fields, { SITE_URL: process.env.SITE_URL });
process.env.SITE_URL += "/";
process.env.SITE_URL === url;
`),
        [
          "2 env",
          "3 env",
          "4 env",
          "5 env",
          "6 env",
          "7 env",
          "8 env",
          "9 env",
          "10 env",
          "11 env",
          "12 env",
          "13 env",
          "14 env",
          "15 env",
        ]
      );
    })
  );

  it.effect("reports a read whose call a local binding shadows", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`import { readEnvironment } from "@repo/utilities/env";
export const env = readEnvironment(fields, { SITE_URL: process.env.SITE_URL });
export function local(readEnvironment: (fields: unknown, values: unknown) => unknown) {
  return readEnvironment(fields, { SITE_URL: process.env.SITE_URL });
}
export const viaObject = readEnvironment(fields, {
  SITE_URL: globalThis.process.env.SITE_URL,
});
`),
        ["4 env", "7 env"]
      );
    })
  );

  it.effect("needs the seam imported as a value from its owner", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`import { readEnvironment } from "@repo/utilities/environment";
import * as Env from "@repo/utilities/env";
import { InvalidEnvironmentError } from "@repo/utilities/env";
export const env = readEnvironment(fields, { SITE_URL: process.env.SITE_URL });
`),
        ["4 env"]
      );
      assert.deepStrictEqual(
        yield* findings(`import type { readEnvironment } from "@repo/utilities/env";
export const env = readEnvironment(fields, { SITE_URL: process.env.SITE_URL });
`),
        ["2 env"]
      );
    })
  );

  it.effect("leaves the other members of a global object alone", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`window.localStorage;
globalThis.location;
self.navigator.userAgent;
`),
        []
      );
    })
  );
});
