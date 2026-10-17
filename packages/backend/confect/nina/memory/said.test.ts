import { RegisteredFunction } from "@confect/server";
import { saveMessages } from "@convex-dev/agent";
import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import schema from "@repo/backend/confect/_generated/schema";
import { readSaid } from "@repo/backend/confect/nina/memory/said";
import { createNinaTest } from "@repo/backend/test/nina";
import {
  copyOf,
  sealThreadIn,
  writtenThreadIn,
} from "@repo/backend/test/nina/seal";
import { Array as Arr, Effect, Option } from "effect";

const PROMPT = "Bagaimana rumus luas lingkaran?";

describe("the learner's words of a turn", () => {
  it("reads no words of an answer the learner did not write, or of a message the component no longer holds", async () => {
    const f = await createNinaTest({ prompt: PROMPT });
    const said = (promptMessageId: string) =>
      f.t.action((ctx) =>
        Effect.runPromise(
          readSaid({ promptMessageId, userId: f.identity.userId }).pipe(
            Effect.provide(RegisteredFunction.actionLayer(schema, ctx))
          )
        )
      );
    const { messages } = await f.t.mutation((ctx) =>
      saveMessages(ctx, components.nina, {
        messages: [{ role: "assistant", content: "Rumusnya πr²." }],
        threadId: f.threadId,
        userId: f.identity.userId,
      })
    );
    const answer = Option.getOrThrow(Arr.head(messages));
    expect(await said(answer._id)).toBe("");
    await f.t.mutation((ctx) =>
      ctx.runMutation(components.nina.messages.deleteByIds, {
        messageIds: [answer._id],
      })
    );
    expect(await said(answer._id)).toBe("");
  });

  it("reads the learner's words of a sealed prompt as of a plain one", async () => {
    const f = await createNinaTest({ prompt: PROMPT });
    const turn = {
      promptMessageId: f.promptMessageId,
      userId: f.identity.userId,
    };
    const said = (read: typeof turn) =>
      f.t.action((ctx) =>
        Effect.runPromise(
          readSaid(read).pipe(
            Effect.provide(RegisteredFunction.actionLayer(schema, ctx))
          )
        )
      );
    const plain = await said(turn);
    const written = await writtenThreadIn(f.t, f.threadId, f.identity.userId);
    const writtenPrompt = copyOf(written, turn.promptMessageId);
    expect(await said({ ...turn, promptMessageId: writtenPrompt })).toBe(plain);
    const replacements = await sealThreadIn(f.t, f.threadId, f.identity.userId);
    const sealed = await said({
      ...turn,
      promptMessageId: copyOf(replacements, writtenPrompt),
    });
    expect(plain).toBe(PROMPT);
    expect(sealed).toBe(plain);
  });

  it("fails with the typed memory read error for a message id the component cannot read", async () => {
    const f = await createNinaTest({ prompt: PROMPT });
    const failure = await f.t.action((ctx) =>
      Effect.runPromise(
        readSaid({ promptMessageId: "gone", userId: f.identity.userId }).pipe(
          Effect.flip,
          Effect.map(({ _tag, operation }) => ({ _tag, operation })),
          Effect.provide(RegisteredFunction.actionLayer(schema, ctx))
        )
      )
    );
    expect(failure).toEqual({ _tag: "NinaMemoryError", operation: "read" });
  });
});
