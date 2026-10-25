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
          "apps/www/src/lib/example.ts"
        ),
        [
          `apps/www/src/lib/example.ts: ${RULE_AGENT}.`,
          `apps/www/src/lib/example.ts: ${RULE_COMPONENT}.`,
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
    "rejects a namespace import of the Agent package, even for a member that reads no message",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import * as agent from "@convex-dev/agent";
const kept = agent.toUIMessages(rows);`),
          [`${MODULE}: ${RULE_AGENT}.`]
        );
      })
  );

  it.effect("rejects a namespace import that destructures a reader", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`import * as agent from "@convex-dev/agent";
const { getFile } = agent;`),
        [`${MODULE}: ${RULE_AGENT}.`]
      );
    })
  );

  it.effect(
    "rejects a dynamic import of the Agent package, whatever it binds",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`const { listMessages } = await import("@convex-dev/agent");
const agent = await import("@convex-dev/agent");
const file = (await import("@convex-dev/agent")).getFile;
void import("@convex-dev/agent").then((module) => module.getFile(ctx, components.nina, fileId));`),
          Arr.replicate(`${MODULE}: ${RULE_AGENT}.`, 4)
        );
      })
  );

  it.effect(
    "accepts a type-only namespace import and a type-level import of the package",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import type * as agent from "@convex-dev/agent";
type Module = typeof import("@convex-dev/agent");
export type Reader = typeof agent.getFile;`),
          []
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
    "accepts the type-only specifiers and type-only exports of the package",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import { Agent, type listMessages } from "@convex-dev/agent";
export type { listMessages } from "@convex-dev/agent";
export { Agent, type getFile } from "@convex-dev/agent";
export type * from "@convex-dev/agent";
export type * as module from "@convex-dev/agent";
import "@convex-dev/agent";`),
          []
        );
      })
  );

  it.effect("rejects a runtime reader beside a type-only specifier", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`import { type listMessages, listUIMessages } from "@convex-dev/agent";
export { type getFile, docsToModelMessages } from "@convex-dev/agent";`),
        Arr.replicate(`${MODULE}: ${RULE_AGENT}.`, 2)
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

  it.effect("rejects a component read taken by destructuring", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`const { listMessagesByThreadId } = components.nina.messages;
const { getMessagesByIds: read } = messages;
const { ...rest } = components.nina.messages;`),
        Arr.replicate(`${MODULE}: ${RULE_COMPONENT}.`, 3)
      );
    })
  );

  it.effect(
    "rejects a component read taken by a string key or a computed key of a destructuring",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`const { "listMessagesByThreadId": first } = components.nina.messages;
const { [name]: second } = messages;`),
          Arr.replicate(`${MODULE}: ${RULE_COMPONENT}.`, 2)
        );
      })
  );

  it.effect("rejects a component read taken by an element access", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`const first = components.nina.messages["listMessagesByThreadId"];
const second = messages["getMessagesByIds"];
const third = components.nina.messages[name];`),
        Arr.replicate(`${MODULE}: ${RULE_COMPONENT}.`, 3)
      );
    })
  );

  it.effect(
    "rejects the component's messages object taken as a value or as a rest of its handle",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`const reads = components.nina.messages;
const { messages: taken } = components.nina;
const { ...all } = components.nina;`),
          Arr.replicate(`${MODULE}: ${RULE_COMPONENT}.`, 3)
        );
      })
  );

  it.effect(
    "accepts the component's writes, a destructured write, and an index of an array named messages",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`const { addMessages } = components.nina.messages;
await ctx.runMutation(components.nina.messages.addMessages, args);
const head = messages[0];
const { length } = messages;
const count = result.messages[0];`),
          []
        );
      })
  );
});
