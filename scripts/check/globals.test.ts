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
});

describe("environment reads", () => {
  it.effect("keeps writes, build constants, and the createEnv seam", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`import { createEnv } from "@t3-oss/env-nextjs";
process.env.NODE_ENV === "production";
process.env.NEXT_RUNTIME === "nodejs";
process.env.SITE_URL = "https://nakafa.com";
process.env.SITE_URL ??= "https://nakafa.com";
delete process.env.SITE_URL;
export const env = createEnv({
  runtimeEnv: { SITE_URL: process.env.SITE_URL },
});
export const server = createEnv({ runtimeEnv: process.env });
export const preview = createEnv({
  experimental__runtimeEnv: { PREVIEW: process.env.PREVIEW },
});
`),
        []
      );
    })
  );

  it.effect("reports every read outside those seams", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`import { createEnv } from "@t3-oss/env-core";
const url = process.env.SITE_URL;
const name = process.env[key];
const inherited = { ...process.env };
const mapping = { runtimeEnv: { SITE_URL: process.env.SITE_URL } };
const local = makeEnv({ runtimeEnv: process.env });
const fallback = createEnv({ runtimeEnv: process.env.SITE_URL ?? {} });
process.env.SITE_URL += "/";
process.env.SITE_URL === url;
`),
        ["2 env", "3 env", "4 env", "5 env", "6 env", "7 env", "8 env", "9 env"]
      );
      assert.deepStrictEqual(
        yield* findings(`import { createEnv } from "@t3-oss/env-nextjs/presets";
import type { Preset } from "@t3-oss/env-nextjs";
import * as Env from "@t3-oss/env-nextjs";
import envCore from "@t3-oss/env-core";
export const env = createEnv({ runtimeEnv: { SITE_URL: process.env.SITE_URL } });
`),
        ["5 env"]
      );
    })
  );
});
