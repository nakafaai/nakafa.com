import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources } from "#scripts/check/source";

const WORKFLOW = "packages/backend/confect/proof/workflow.ts";

/** Lists the Effect-native findings of one module as `line rule`, in a Confect workflow module by default. */
const findings = Effect.fn("WorkflowPolicyTest.findings")(function* (
  sourceText: string,
  file = WORKFLOW
) {
  const found = yield* effectFindings(
    yield* parseSources([{ file, sourceText }])
  );
  return Arr.map(found, ({ line, rule }) => `${line} ${rule}`);
}, Effect.scoped);

describe("Confect workflow handlers", () => {
  it.effect("sees a handler written in parentheses or a type assertion", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(
          `import { workflow } from "@repo/backend/confect/workflow";
export const verify = workflow.define({
  handler: (async (step) => step.runAction(run)),
});
const retry = (async (step) => {
  await step.runAction(retry);
});
export const again = workflow.define({ handler: (retry as typeof retry) });
export const bare = (async () => {
  await run();
});
`,
          WORKFLOW
        ),
        ["8 assertion", "9 promise", "10 promise"]
      );
    })
  );

  it.effect("sees a handler through each wrapper of its value or binding", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(
          `import { workflow } from "@repo/backend/confect/workflow";
export const asserted = workflow.define({
  handler: (async (step) => step.runAction(run)) as Handler,
});
export const satisfied = workflow.define({
  handler: (async (step) => step.runAction(run)) satisfies Handler,
});
export const negated = workflow.define({
  handler: (async (step) => step.runAction(run))!,
});
const retry = (async (step) => {
  await step.runAction(retry);
}) as Handler;
export const again = workflow.define({ handler: retry satisfies Handler });
export const bare = (async () => {
  await run();
}) as Other;
`,
          WORKFLOW
        ),
        [
          "3 assertion",
          "9 assertion",
          "11 assertion",
          "15 assertion",
          "15 promise",
          "16 promise",
        ]
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
        ["6 new-promise"]
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
