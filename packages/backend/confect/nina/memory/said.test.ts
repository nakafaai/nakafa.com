import { RegisteredFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import schema from "@repo/backend/confect/_generated/schema";
import { readSaid } from "@repo/backend/confect/nina/memory/said";
import { createNinaTest } from "@repo/backend/test/nina";
import { copyOf, sealThreadIn } from "@repo/backend/test/nina/seal";
import { Effect } from "effect";

const PROMPT = "Bagaimana rumus luas lingkaran?";

describe("the learner's words of a turn", () => {
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
    const replacements = await sealThreadIn(f.t, f.threadId, f.identity.userId);
    const sealed = await said({
      ...turn,
      promptMessageId: copyOf(replacements, turn.promptMessageId),
    });
    expect(plain).toBe(PROMPT);
    expect(sealed).toBe(plain);
  });
});
