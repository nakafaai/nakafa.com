import { Ref } from "@confect/core";
import { createThread, listStreams, syncStreams } from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { AGENT_ID_LENGTH } from "@repo/backend/confect/nina/contract/message";
import { readThread } from "@repo/backend/confect/nina/sealed/thread";
import { createThreadTest } from "@repo/backend/test/nina/thread";

vi.mock("@repo/backend/confect/nina/sealed/thread", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@repo/backend/confect/nina/sealed/thread")
    >();
  return { ...actual, readThread: vi.fn(actual.readThread) };
});
vi.mock("@convex-dev/agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@convex-dev/agent")>();
  return {
    ...actual,
    listStreams: vi.fn(actual.listStreams),
    syncStreams: vi.fn(actual.syncStreams),
  };
});

const query = Ref.getFunctionReference(refs.public.nina.messages.page);

describe("Nina stream reads", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("resumes only deltas belonging to the authorized thread", async () => {
    const { t, owner, identity, args } = await createThreadTest();
    const streams = await t.mutation(async (ctx) => {
      const otherThread = await createThread(ctx, components.nina);
      const own = await ctx.runMutation(components.nina.streams.create, {
        threadId: identity.threadId,
        order: 1,
        stepOrder: 0,
        format: "UIMessageChunk",
      });
      const other = await ctx.runMutation(components.nina.streams.create, {
        threadId: otherThread,
        order: 1,
        stepOrder: 0,
        format: "UIMessageChunk",
      });
      for (const [streamId, delta] of [
        [own, "Allowed"],
        [other, "Private"],
      ] as const) {
        await ctx.runMutation(components.nina.streams.addDelta, {
          streamId,
          start: 0,
          end: 1,
          parts: [{ type: "text-delta", id: "text-1", delta }],
        });
      }
      return { own, other };
    });
    const listed = Ref.decodeReturnsSync(
      refs.public.nina.messages.page,
      await owner.query(query, { ...args, streamArgs: { kind: "list" } })
    );
    expect(listed.streams).toEqual({
      kind: "list",
      messages: [expect.objectContaining({ streamId: streams.own })],
    });
    expect(listed.page).toEqual([]);
    const resumed = Ref.decodeReturnsSync(
      refs.public.nina.messages.page,
      await owner.query(query, {
        ...args,
        streamArgs: {
          kind: "deltas",
          cursors: [
            { streamId: streams.own, cursor: 0 },
            { streamId: streams.own, cursor: 0 },
            { streamId: streams.other, cursor: 0 },
            { streamId: "expired", cursor: 0 },
          ],
        },
      })
    );
    expect(resumed.streams).toEqual({
      kind: "deltas",
      deltas: [
        {
          streamId: streams.own,
          start: 0,
          end: 1,
          parts: [{ type: "text-delta", id: "text-1", delta: "Allowed" }],
        },
      ],
    });
    expect(resumed.page).toEqual([]);
    // Stream round trips never re-read the transcript.
    expect(readThread).not.toHaveBeenCalled();
    expect(syncStreams).toHaveBeenLastCalledWith(
      expect.anything(),
      components.nina,
      {
        threadId: identity.threadId,
        streamArgs: {
          kind: "deltas",
          cursors: [{ streamId: streams.own, cursor: 0 }],
        },
      }
    );
  });

  it.each([
    [{ streamId: "invalid", cursor: -1 }],
    [{ streamId: "invalid", cursor: 0.5 }],
    Array.from({ length: 101 }, () => ({ streamId: "invalid", cursor: 0 })),
  ])(
    "rejects invalid or unbounded cursor batches before reading the component",
    async (...cursors) => {
      const { owner, args } = await createThreadTest();
      await expect(
        owner.query(query, { ...args, streamArgs: { kind: "deltas", cursors } })
      ).rejects.toThrow();
      expect(readThread).not.toHaveBeenCalled();
      expect(syncStreams).not.toHaveBeenCalled();
    }
  );

  it("takes the id of a stream of the longest length and refuses a longer one before it reads anything", async () => {
    const { owner, args } = await createThreadTest();
    const longest = "x".repeat(AGENT_ID_LENGTH);
    const longer = "x".repeat(AGENT_ID_LENGTH + 1);
    // A stream the thread does not hold is left out, whatever its id.
    await expect(
      owner.query(query, {
        ...args,
        streamArgs: {
          kind: "deltas",
          cursors: [{ streamId: longest, cursor: 0 }],
        },
      })
    ).resolves.toMatchObject({ streams: { kind: "deltas", deltas: [] } });
    vi.clearAllMocks();
    await expect(
      owner.query(query, {
        ...args,
        streamArgs: {
          kind: "deltas",
          cursors: [{ streamId: longer, cursor: 0 }],
        },
      })
    ).rejects.toMatchObject({
      _tag: "SchemaError",
      message: expect.stringContaining("streamId"),
    });
    expect(listStreams).not.toHaveBeenCalled();
    expect(syncStreams).not.toHaveBeenCalled();
  });

  it.each([
    ["streams", { kind: "deltas", cursors: [] }],
    ["cursors", { kind: "deltas", cursors: [] }],
    ["missing streams", { kind: "list" }],
  ] as const)("redacts %s transport failures", async (source, streamArgs) => {
    const { owner, args } = await createThreadTest();
    const error = new Error("private transport diagnostic");
    if (source === "streams") {
      vi.mocked(syncStreams).mockRejectedValueOnce(error);
    }
    if (source === "cursors") {
      vi.mocked(listStreams).mockRejectedValueOnce(error);
    }
    if (source === "missing streams") {
      vi.mocked(syncStreams).mockResolvedValueOnce(undefined);
    }
    await expect(
      owner.query(query, { ...args, streamArgs })
    ).rejects.toMatchObject({
      data: { _tag: "NinaReadError", message: "Unable to read Nina streams." },
    });
  });
});
