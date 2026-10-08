import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources } from "#scripts/check/source";

const CODE = "apps/www/lib/example.ts";
const SCRIPT = "scripts/tool.ts";
const WORKFLOW = "packages/backend/confect/proof/workflow.ts";

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

  it.effect("lets a Confect workflow handler use native promise syntax", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(
          `import { workflow } from "@repo/backend/confect/workflow";
export const verify = workflow.define({
  handler: async (step) => {
    await step.runAction(run);
    const receipts = await Promise.all([step.runQuery(read)]);
    return new Promise(finish);
  },
});
export const deliver = workflow.define({ retries: 2, handler: send });
export async function send(step) {
  await step.runAction(deliver);
}
const retry = async (step) => {
  await step.runAction(retry);
};
export const again = workflow.define({ handler: retry });
`,
          WORKFLOW
        ),
        ["6 promise"]
      );
    })
  );

  it.effect(
    "keeps native promise syntax outside Confect workflow handlers",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(
            `import { workflow } from "@repo/backend/confect/workflow";
export const verify = workflow.define({
  handler: async (step) => step.runAction(run),
});
export async function helper() {
  await run();
}
export const other = somethingElse.define({
  handler: async (step) => {
    await step.runAction(run);
  },
});
`,
            WORKFLOW
          ),
          ["5 promise", "6 promise", "9 promise", "10 promise"]
        );
        assert.deepStrictEqual(
          yield* findings(
            `import { workflow } from "./workflow";
export const verify = workflow.define({
  handler: async (step) => {
    await step.runAction(run);
  },
});
`,
            WORKFLOW
          ),
          ["3 promise", "4 promise"]
        );
      })
  );

  it.effect(
    "keeps workflow handlers reported when define does not name the Confect export",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(
            `import workflow from "@repo/backend/confect/workflow";
export const first = workflow.define({
  handler: async (step) => step.runAction(run),
});
import * as workflows from "@repo/backend/confect/workflow";
export const second = workflows.define({
  handler: async (step) => step.runAction(run),
});
import { other } from "@repo/backend/confect/workflow";
export const third = other.define({ handler: async (step) => step.runAction(run) });
`,
            WORKFLOW
          ),
          ["3 promise", "7 promise", "10 promise"]
        );
      })
  );

  it.effect(
    "keeps a handler reported when the module does not define it inline or by name",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(
            `import { workflow } from "@repo/backend/confect/workflow";
const definition = { handler: async (step) => step.runAction(run) };
export const verify = workflow.define(definition);
export const wrapped = workflow.define({ handler: wrap(async (step) => step.runAction(run)) });
`,
            WORKFLOW
          ),
          ["2 promise", "4 promise"]
        );
      })
  );

  it.effect(
    "lets a workflow handler keep promise syntax under any spelling of its key",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(
            `import { workflow } from "@repo/backend/confect/workflow";
const handler = async (step) => {
  await step.runAction(run);
};
export const shorthand = workflow.define({ handler });
export const method = workflow.define({
  async handler(step) {
    await step.runAction(run);
  },
});
export const quoted = workflow.define({
  "handler": async (step) => {
    await step.runAction(run);
  },
});
export const computed = workflow.define({
  ["handler"]: async (step) => step.runAction(run),
});
`,
            WORKFLOW
          ),
          []
        );
      })
  );

  it.effect(
    "keeps promise syntax reported when the handler key binds no function",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(
            `import { workflow } from "@repo/backend/confect/workflow";
const handler = wrap(async (step) => {
  await step.runAction(run);
});
export const wrapped = workflow.define({ handler });
export const other = workflow.define({
  async other(step) {
    await step.runAction(run);
  },
});
export const dynamic = workflow.define({
  [name]: async (step) => step.runAction(run),
});
`,
            WORKFLOW
          ),
          ["2 promise", "3 promise", "7 promise", "8 promise", "12 promise"]
        );
      })
  );

  it.effect("resolves a handler name in the scope that declares it", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(
          `import { workflow } from "@repo/backend/confect/workflow";
export async function handler(step) {
  await step.runAction(run);
}
export function build() {
  const handler = async (step) => {
    await step.runAction(run);
  };
  return workflow.define({ handler: handler });
}
export const shadowed = (handler) => workflow.define({ handler });
`,
          WORKFLOW
        ),
        ["2 promise", "3 promise"]
      );
    })
  );

  it.effect("reads only the handler option among the other options", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(
          `import { workflow } from "@repo/backend/confect/workflow";
const retries = 2;
export const spread = workflow.define({
  ...base,
  retries,
  handler: async (step) => step.runAction(run),
});
export const other = workflow.define({ retries, handler: wrap(async (step) => step.runAction(run)) });
`,
          WORKFLOW
        ),
        ["8 promise"]
      );
    })
  );
});
