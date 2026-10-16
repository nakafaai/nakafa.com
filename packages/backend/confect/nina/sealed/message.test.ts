import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import {
  copyOf,
  sealThreadIn,
  withoutRowIds,
} from "@repo/backend/test/nina/seal";
import {
  messageFailureIn,
  readMessageIn,
} from "@repo/backend/test/nina/sealed";
import { createThreadTest } from "@repo/backend/test/nina/thread";
import { Array as Arr, Option } from "effect";

type Fixture = Awaited<ReturnType<typeof createThreadTest>>;

/** The id of the learner's prompt, the first message of the fixture thread. */
function promptIdOf(t: Fixture["t"], threadId: string) {
  return t.mutation(async (ctx) => {
    const { page } = await ctx.runQuery(
      components.nina.messages.listMessagesByThreadId,
      {
        order: "asc",
        paginationOpts: { cursor: null, numItems: 100 },
        threadId,
      }
    );
    return Option.getOrThrow(
      Arr.findFirst(page, (row) => row.message?.role === "user")
    )._id;
  });
}

describe("reading one message through the sealed module", () => {
  it("reads a sealed prompt as the plain prompt reads it", async () => {
    const f = await createThreadTest();
    const owner = f.identity.userId;
    const promptId = await promptIdOf(f.t, f.identity.threadId);
    const plain = await readMessageIn(f.t, owner, promptId);
    const replacements = await sealThreadIn(f.t, f.identity.threadId, owner);
    const sealed = await readMessageIn(
      f.t,
      owner,
      copyOf(replacements, promptId)
    );
    expect(withoutRowIds(sealed)).toEqual(withoutRowIds(plain));
    expect(sealed?.text).toBe("Explain a limit.");
  });

  it("reads null for a message the component no longer holds", async () => {
    const f = await createThreadTest();
    const owner = f.identity.userId;
    const promptId = await promptIdOf(f.t, f.identity.threadId);
    await f.t.mutation((ctx) =>
      ctx.runMutation(components.nina.messages.deleteByIds, {
        messageIds: [promptId],
      })
    );
    expect(await readMessageIn(f.t, owner, promptId)).toBeNull();
  });

  it("fails with a sealed read error for an id that names no message", async () => {
    const f = await createThreadTest();
    const failure = await messageFailureIn(
      f.t,
      f.identity.userId,
      "not-a-message"
    );
    expect(failure).toBe("SealedReadError");
  });
});
