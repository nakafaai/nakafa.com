import { createThread, saveMessage, saveMessages } from "@convex-dev/agent";
import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import {
  readPromptInput,
  readRecentContext,
} from "@repo/backend/confect/nina/sealed/context";
import type { Replacement } from "@repo/backend/test/nina/seal";
import {
  copyOf,
  sealThreadIn,
  withoutRowIds,
  writtenThreadIn,
} from "@repo/backend/test/nina/seal";
import { inAction } from "@repo/backend/test/nina/sealed";
import { createThreadTest } from "@repo/backend/test/nina/thread";
import type { ModelMessage } from "ai";
import { Array as Arr } from "effect";

type Fixture = Awaited<ReturnType<typeof createThreadTest>>;
type Owner = Fixture["identity"]["userId"];

/**
 * A thread of one turn whose prompt has the given status, with the answers that
 * follow it, written the way the Agent writes them. It returns the prompt that
 * the reads name.
 */
function turnThread(
  t: Fixture["t"],
  userId: Owner,
  turn: {
    readonly answers: readonly ModelMessage[];
    readonly promptStatus: "failed" | "success";
  }
) {
  return t.mutation(async (ctx) => {
    const threadId = await createThread(ctx, components.nina, { userId });
    const prompt = await saveMessage(ctx, components.nina, {
      prompt: "Jelaskan limit.",
      threadId,
    });
    if (Arr.isReadonlyArrayNonEmpty(turn.answers)) {
      await saveMessages(ctx, components.nina, {
        messages: [...turn.answers],
        promptMessageId: prompt.messageId,
        threadId,
      });
    }
    // The answers are saved while the prompt succeeds, as a turn saves them.
    if (turn.promptStatus !== "success") {
      await ctx.runMutation(components.nina.messages.updateMessage, {
        messageId: prompt.messageId,
        patch: { status: turn.promptStatus },
      });
    }
    return { promptMessageId: prompt.messageId, threadId };
  });
}

/** The same read, naming the prompt by the id that its sealed copy has. */
function afterSeal<T extends { readonly promptMessageId: string }>(
  read: T,
  replacements: readonly Replacement[]
): T {
  return {
    ...read,
    promptMessageId: copyOf(replacements, read.promptMessageId),
  };
}

/** The recent context of one turn: the window the Agent's own fetch read for suggestions. */
const SUGGESTIONS = { excludeToolMessages: true, recentMessages: 16 };

describe("the recent context of a turn through the sealed module", () => {
  it("gives the suggestions the window the Agent read, with the same rows opened", async () => {
    const f = await createThreadTest();
    const owner = f.identity.userId;
    const read = {
      ...SUGGESTIONS,
      promptMessageId: f.promptMessageId,
      threadId: f.identity.threadId,
    };
    const plain = await inAction(f.t, readRecentContext(owner, read));
    const written = await writtenThreadIn(f.t, f.identity.threadId, owner);
    expect(
      withoutRowIds(
        await inAction(f.t, readRecentContext(owner, afterSeal(read, written)))
      )
    ).toEqual(withoutRowIds(plain));
    const replacements = await sealThreadIn(f.t, f.identity.threadId, owner);
    const sealed = await inAction(
      f.t,
      readRecentContext(
        owner,
        afterSeal(afterSeal(read, written), replacements)
      )
    );
    expect(withoutRowIds(sealed)).toEqual(withoutRowIds(plain));
    expect(sealed.inputPrompt).toHaveLength(1);
    expect(sealed.inputPrompt).toMatchObject([{ role: "user" }]);
  });

  it("finishes the oldest order of a window that cut it short, with the same steps", async () => {
    const f = await createThreadTest();
    const owner = f.identity.userId;
    const read = {
      excludeToolMessages: false,
      promptMessageId: f.promptMessageId,
      recentMessages: 2,
      threadId: f.identity.threadId,
    };
    const plain = await inAction(f.t, readRecentContext(owner, read));
    const written = await writtenThreadIn(f.t, f.identity.threadId, owner);
    expect(
      withoutRowIds(
        await inAction(f.t, readRecentContext(owner, afterSeal(read, written)))
      )
    ).toEqual(withoutRowIds(plain));
    const replacements = await sealThreadIn(f.t, f.identity.threadId, owner);
    const sealed = await inAction(
      f.t,
      readRecentContext(
        owner,
        afterSeal(afterSeal(read, written), replacements)
      )
    );
    expect(withoutRowIds(sealed)).toEqual(withoutRowIds(plain));
    expect(sealed.inputPrompt).toHaveLength(1);
    expect(sealed.existingResponses.length).toBeGreaterThan(1);
  });

  it("reads a continued order across multiple boundary pages, and stops after one page for an older order", async () => {
    const f = await createThreadTest();
    const owner = f.identity.userId;
    const thread = await f.t.mutation(async (ctx) => {
      const threadId = await createThread(ctx, components.nina, {
        userId: owner,
      });
      const firstPrompt = await saveMessage(ctx, components.nina, {
        prompt: "Pertanyaan pertama.",
        threadId,
      });
      await saveMessages(ctx, components.nina, {
        messages: [
          { content: "Langkah 1.", role: "assistant" },
          { content: "Langkah 2.", role: "assistant" },
          { content: "Langkah 3.", role: "assistant" },
        ],
        promptMessageId: firstPrompt.messageId,
        threadId,
      });
      const secondPrompt = await saveMessage(ctx, components.nina, {
        prompt: "Pertanyaan kedua.",
        threadId,
      });
      const secondSteps = await saveMessages(ctx, components.nina, {
        messages: [
          { content: "Jawaban 1.", role: "assistant" },
          { content: "Jawaban 2.", role: "assistant" },
          { content: "Jawaban 3.", role: "assistant" },
        ],
        promptMessageId: secondPrompt.messageId,
        threadId,
      });
      return {
        firstPromptId: firstPrompt.messageId,
        secondPromptId: secondPrompt.messageId,
        secondStepId: secondSteps.messages[1]?._id ?? "",
        threadId,
      };
    });

    // Continued order (all rows of the first page belong to order 1, prompt is step 0):
    // loops boundary pages of size 1 until step 0 of order 1 is reached, and stops before order 0.
    const multiPage = await inAction(
      f.t,
      readRecentContext(owner, {
        boundaryLimit: 1,
        excludeToolMessages: false,
        promptMessageId: thread.secondPromptId,
        recentMessages: 1,
        threadId: thread.threadId,
      })
    );
    expect(multiPage.inputPrompt).toHaveLength(1);
    expect(multiPage.existingResponses).toHaveLength(3);
    expect(multiPage.recent).toEqual([]);

    // Continued order where the target message itself is already inside the first page (step > 0):
    // still loops back to step 0 of the continued order.
    const targetInFirstPage = await inAction(
      f.t,
      readRecentContext(owner, {
        boundaryLimit: 1,
        excludeToolMessages: false,
        promptMessageId: thread.secondStepId,
        recentMessages: 2,
        threadId: thread.threadId,
      })
    );
    expect(targetInFirstPage.recent).toHaveLength(2);
    expect(targetInFirstPage.inputPrompt).toHaveLength(1);
    expect(targetInFirstPage.existingResponses).toHaveLength(1);

    // Continued order at order 0 reaches the start of the thread (next.isDone = true).
    const firstOrderMultiPage = await inAction(
      f.t,
      readRecentContext(owner, {
        boundaryLimit: 1,
        excludeToolMessages: false,
        promptMessageId: thread.firstPromptId,
        recentMessages: 1,
        threadId: thread.threadId,
      })
    );
    expect(firstOrderMultiPage.inputPrompt).toHaveLength(1);
    expect(firstOrderMultiPage.existingResponses).toHaveLength(3);

    // Older order split by a window that starts in order 1: reads only one boundary page
    // (1 row) and trims the still-incomplete older order instead of looping.
    const olderSplit = await inAction(
      f.t,
      readRecentContext(owner, {
        boundaryLimit: 1,
        excludeToolMessages: false,
        promptMessageId: thread.secondPromptId,
        recentMessages: 5,
        threadId: thread.threadId,
      })
    );
    expect(olderSplit.recent).toEqual([]);
    expect(olderSplit.inputPrompt).toHaveLength(1);
    expect(olderSplit.existingResponses).toHaveLength(3);
  });

  it("drops an order that the window cut short when no step of it is in the window", async () => {
    const f = await createThreadTest();
    const cancelled = await turnThread(f.t, f.identity.userId, {
      answers: [{ content: "Jawaban yang terpotong.", role: "assistant" }],
      promptStatus: "failed",
    });
    const read = {
      ...SUGGESTIONS,
      promptMessageId: cancelled.promptMessageId,
      threadId: cancelled.threadId,
    };
    const plain = await inAction(
      f.t,
      readRecentContext(f.identity.userId, read)
    );
    const replacements = await sealThreadIn(
      f.t,
      cancelled.threadId,
      f.identity.userId
    );
    const sealed = await inAction(
      f.t,
      readRecentContext(f.identity.userId, afterSeal(read, replacements))
    );
    expect(withoutRowIds(sealed)).toEqual(withoutRowIds(plain));
    expect(sealed).toEqual({
      existingResponses: [],
      inputPrompt: [],
      recent: [],
    });
  });

  it("gives an empty window when the window holds no message of the turn", async () => {
    const f = await createThreadTest();
    const failed = await turnThread(f.t, f.identity.userId, {
      answers: [],
      promptStatus: "failed",
    });
    const read = {
      ...SUGGESTIONS,
      promptMessageId: failed.promptMessageId,
      threadId: failed.threadId,
    };
    const plain = await inAction(
      f.t,
      readRecentContext(f.identity.userId, read)
    );
    const replacements = await sealThreadIn(
      f.t,
      failed.threadId,
      f.identity.userId
    );
    const sealed = await inAction(
      f.t,
      readRecentContext(f.identity.userId, afterSeal(read, replacements))
    );
    expect(withoutRowIds(sealed)).toEqual(withoutRowIds(plain));
    expect(sealed).toEqual({
      existingResponses: [],
      inputPrompt: [],
      recent: [],
    });
  });
});

describe("the prompt input of a turn through the sealed module", () => {
  it("gives the successful prompt as the model input, opened, as a plain prompt gives it", async () => {
    const f = await createThreadTest();
    const owner = f.identity.userId;
    const promptMessageId = f.promptMessageId;
    const plain = await inAction(f.t, readPromptInput(owner, promptMessageId));
    const written = await writtenThreadIn(f.t, f.identity.threadId, owner);
    expect(
      await inAction(
        f.t,
        readPromptInput(owner, copyOf(written, promptMessageId))
      )
    ).toEqual(plain);
    const replacements = await sealThreadIn(f.t, f.identity.threadId, owner);
    const sealed = await inAction(
      f.t,
      readPromptInput(
        owner,
        copyOf(replacements, copyOf(written, promptMessageId))
      )
    );
    expect(sealed).toEqual(plain);
    expect(sealed).toHaveLength(1);
    expect(sealed).toMatchObject([{ role: "user" }]);
  });

  it("gives no input for a prompt that failed, and for a prompt that is gone", async () => {
    const f = await createThreadTest();
    const failed = await turnThread(f.t, f.identity.userId, {
      answers: [],
      promptStatus: "failed",
    });
    expect(
      await inAction(
        f.t,
        readPromptInput(f.identity.userId, failed.promptMessageId)
      )
    ).toEqual([]);
    await f.t.mutation((ctx) =>
      ctx.runMutation(components.nina.messages.deleteByIds, {
        messageIds: [failed.promptMessageId],
      })
    );
    expect(
      await inAction(
        f.t,
        readPromptInput(f.identity.userId, failed.promptMessageId)
      )
    ).toEqual([]);
  });
});
