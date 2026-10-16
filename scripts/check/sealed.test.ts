import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectSealedSource } from "#scripts/check/sealed";
import { parseSources } from "#scripts/check/source";

const MODULE = "packages/backend/confect/nina/messages/page.ts";
const RULE_AGENT =
  "read Nina messages and files through the sealed module, packages/backend/confect/nina/sealed (its thread, message, and file reads open each row, and its model messages convert opened rows), instead of listMessages, listUIMessages, docsToModelMessages, or getFile from @convex-dev/agent";
const RULE_COMPONENT =
  "read the Agent component's messages through the sealed module, packages/backend/confect/nina/sealed, instead of messages.listMessagesByThreadId or messages.getMessagesByIds, which return sealed rows as they are";

/** Inspects one module with the sealed message policy alone. */
function inspect(sourceText: string, file = MODULE) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectSealedSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Sealed message source policy", () => {
  it.effect("accepts the Agent's other exports and the type-only readers", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
import { toUIMessages, type MessageDoc } from "@convex-dev/agent";
import type { listMessages } from "@convex-dev/agent";
import { Agent, createTool } from "@convex-dev/agent";
export { toUIMessages } from "@convex-dev/agent";
const page = toUIMessages(rows);
const threads = components.nina.threads.get;
const other = components.nina.messages.listMessages;
const summary = { listMessagesByThreadId: 1 };
const read = summary.listMessagesByThreadId;`),
        []
      );
    })
  );

  it.effect("accepts the sealed module's own reads", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(
          `import { listMessages } from "@convex-dev/agent";
const page = await listMessages(ctx, components.nina, args);
const rows = await ctx.runQuery(components.nina.messages.getMessagesByIds, ids);`,
          "packages/backend/confect/nina/sealed/thread.ts"
        ),
        []
      );
    })
  );

  it.effect("accepts the backend test helpers and the tests", () =>
    Effect.gen(function* () {
      const reader = `import { listUIMessages } from "@convex-dev/agent";
const rows = await ctx.runQuery(components.nina.messages.listMessagesByThreadId, args);`;
      assert.deepStrictEqual(
        yield* inspect(reader, "packages/backend/test/nina.ts"),
        []
      );
      assert.deepStrictEqual(
        yield* inspect(
          reader,
          "packages/backend/confect/nina/memory/said.test.ts"
        ),
        []
      );
    })
  );

  it.effect("rejects a reader in a module outside the backend too", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(
          `import { listUIMessages } from "@convex-dev/agent";
const rows = await ctx.runQuery(components.nina.messages.listMessagesByThreadId, args);`,
          "apps/www/lib/example.ts"
        ),
        [
          `apps/www/lib/example.ts: ${RULE_AGENT}.`,
          `apps/www/lib/example.ts: ${RULE_COMPONENT}.`,
        ]
      );
    })
  );

  it.effect("rejects a reader imported under any local name", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(
          `import { listUIMessages as list, getFile } from "@convex-dev/agent";`
        ),
        [`${MODULE}: ${RULE_AGENT}.`]
      );
    })
  );

  it.effect(
    "rejects a reader that a namespace import of the Agent package reads",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import * as agent from "@convex-dev/agent";
const file = await agent.getFile(ctx, components.nina, fileId);
const model = agent.docsToModelMessages(rows);
const kept = agent.toUIMessages(rows);`),
          Arr.replicate(`${MODULE}: ${RULE_AGENT}.`, 2)
        );
      })
  );

  it.effect("rejects a reader that the Agent package re-exports", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`export { listMessages } from "@convex-dev/agent";
export * from "@convex-dev/agent";
export * as agent from "@convex-dev/agent";`),
        Arr.replicate(`${MODULE}: ${RULE_AGENT}.`, 3)
      );
    })
  );

  it.effect(
    "rejects a component read that returns sealed rows as they are",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`const rows = await ctx.runQuery(components.nina.messages.listMessagesByThreadId, args);
const [prompt] = await ctx.runQuery(components.nina.messages.getMessagesByIds, ids);
const again = await messages.getMessagesByIds(ctx, ids);`),
          Arr.replicate(`${MODULE}: ${RULE_COMPONENT}.`, 3)
        );
      })
  );
});
