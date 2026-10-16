import { createThread, saveMessage } from "@convex-dev/agent";
import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { isSealed } from "@repo/backend/confect/nina/sealed";
import { sealThreadIn, withoutRowIds } from "@repo/backend/test/nina/seal";
import { readThreadIn, threadFailureIn } from "@repo/backend/test/nina/sealed";
import { createThreadTest } from "@repo/backend/test/nina/thread";
import { Array as Arr } from "effect";

type Fixture = Awaited<ReturnType<typeof createThreadTest>>;

/** The owner of the fixture's thread, and the thread, as the reads name them. */
function scopeOf(f: Fixture) {
  return { owner: f.identity.userId, threadId: f.identity.threadId };
}

/** Lists a thread as the component stores it: every row, newest first, with nothing opened. */
function storedRowsOf(t: Fixture["t"], threadId: string) {
  return t.mutation((ctx) =>
    ctx.runQuery(components.nina.messages.listMessagesByThreadId, {
      order: "desc",
      paginationOpts: { cursor: null, numItems: 100 },
      threadId,
    })
  );
}

const FIRST_PAGE = { cursor: null, numItems: 50 };

describe("reading a thread through the sealed module", () => {
  it("reads a sealed thread as the plain thread reads it, with the rows opened", async () => {
    const f = await createThreadTest();
    const scope = scopeOf(f);
    const plain = await readThreadIn(f.t, {
      ...scope,
      paginationOpts: FIRST_PAGE,
    });
    await sealThreadIn(f.t, scope.threadId, scope.owner);
    const stored = await storedRowsOf(f.t, scope.threadId);
    expect(
      Arr.every(
        Arr.filter(stored.page, (row) => row.message?.role !== "user"),
        isSealed
      )
    ).toBe(true);
    const sealed = await readThreadIn(f.t, {
      ...scope,
      paginationOpts: FIRST_PAGE,
    });
    expect(withoutRowIds(sealed)).toEqual(withoutRowIds(plain));
    expect(sealed.page.length).toBeGreaterThan(1);
  });

  it("reads a page of no message without a query, and keeps its cursor", async () => {
    const f = await createThreadTest();
    const scope = scopeOf(f);
    expect(
      await readThreadIn(f.t, {
        ...scope,
        paginationOpts: { cursor: null, numItems: 0 },
      })
    ).toEqual({ continueCursor: "", isDone: true, page: [] });
    expect(
      await readThreadIn(f.t, {
        ...scope,
        paginationOpts: { cursor: "cursor-1", numItems: 0 },
      })
    ).toEqual({ continueCursor: "cursor-1", isDone: true, page: [] });
  });

  it("applies the statuses and the tool filter that the read names", async () => {
    const f = await createThreadTest();
    const scope = scopeOf(f);
    const answers = await readThreadIn(f.t, {
      ...scope,
      excludeToolMessages: true,
      paginationOpts: FIRST_PAGE,
      statuses: ["success"],
    });
    expect(Arr.every(answers.page, (row) => !row.tool)).toBe(true);
    expect(Arr.every(answers.page, (row) => row.status === "success")).toBe(
      true
    );
  });

  it("fails with a sealed read error when the component cannot list the thread", async () => {
    const f = await createThreadTest();
    const other = await f.t.mutation(async (ctx) => {
      const threadId = await createThread(ctx, components.nina, {});
      const { messageId } = await saveMessage(ctx, components.nina, {
        prompt: "Di chat lain.",
        threadId,
      });
      return messageId;
    });
    const failure = await threadFailureIn(f.t, {
      ...scopeOf(f),
      paginationOpts: FIRST_PAGE,
      upToAndIncludingMessageId: other,
    });
    expect(failure).toBe("SealedReadError");
  });
});
