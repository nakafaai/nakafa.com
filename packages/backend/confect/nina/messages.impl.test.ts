import { Ref } from "@confect/core";
import {
  createThread,
  listStreams,
  listUIMessages,
  saveMessage,
  saveMessages,
  syncStreams,
} from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";

vi.mock("@convex-dev/agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@convex-dev/agent")>();
  return {
    ...actual,
    listStreams: vi.fn(actual.listStreams),
    listUIMessages: vi.fn(actual.listUIMessages),
    syncStreams: vi.fn(actual.syncStreams),
  };
});

const query = Ref.getFunctionReference(refs.public.nina.messages.list);
const paginationOpts = { cursor: null, numItems: 20 };

async function fixture(visibility: "private" | "public" = "private") {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation(async (ctx) => {
    const user = await seedAuthenticatedUser(ctx, { now: Date.now() });
    const threadId = await createThread(ctx, components.nina, {
      userId: user.userId,
    });
    const chatId = await ctx.db.insert("chats", {
      threadId,
      type: "study",
      userId: user.userId,
      updatedAt: Date.now(),
      visibility,
    });
    const prompt = await saveMessage(ctx, components.nina, {
      threadId,
      prompt: "Explain a limit.",
    });
    await saveMessages(ctx, components.nina, {
      threadId,
      promptMessageId: prompt.messageId,
      messages: [
        {
          role: "assistant",
          content: [
            {
              type: "reasoning",
              text: "Check the expression.",
              providerOptions: { gateway: { signature: "continuation" } },
            },
            {
              type: "tool-call",
              toolCallId: "math-1",
              toolName: "math",
              input: { expression: "1+1" },
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "math-1",
              toolName: "math",
              output: {
                type: "json",
                value: {
                  text: "2",
                  artifacts: [
                    { type: "data-math", id: "math-1", data: { primary: "2" } },
                  ],
                },
              },
            },
          ],
        },
        { role: "assistant", content: "The value is 2." },
      ],
    });
    return { ...user, chatId, threadId };
  });
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  return {
    t,
    owner,
    identity,
    args: {
      chatId: identity.chatId,
      threadId: identity.threadId,
      paginationOpts,
    },
  };
}

describe("Nina message boundary", () => {
  afterEach(() => vi.clearAllMocks());

  it("reads the component transcript with reasoning and tool artifacts intact", async () => {
    const { owner, args } = await fixture();
    const page = Ref.decodeReturnsSync(
      refs.public.nina.messages.list,
      await owner.query(query, args)
    );
    expect(page.streams).toEqual({ kind: "list", messages: [] });
    const assistant = page.page.find((message) => message.role === "assistant");
    expect(assistant?.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "reasoning",
          text: "Check the expression.",
        }),
        expect.objectContaining({
          type: "tool-math",
          state: "output-available",
          output: {
            text: "2",
            artifacts: [
              { type: "data-math", id: "math-1", data: { primary: "2" } },
            ],
          },
        }),
        expect.objectContaining({ type: "text", text: "The value is 2." }),
      ])
    );
    expect(
      page.page.some((message) => message.text === "Explain a limit.")
    ).toBe(true);
  });

  it("allows an anonymous public reader and denies a private reader before touching the component", async () => {
    const publicChat = await fixture("public");
    await expect(
      publicChat.t.query(query, publicChat.args)
    ).resolves.toHaveProperty("page");
    vi.clearAllMocks();
    const privateChat = await fixture();
    await expect(
      privateChat.t.query(query, privateChat.args)
    ).rejects.toMatchObject({
      data: { _tag: "ChatAccessError", code: "FORBIDDEN" },
    });
    expect(listUIMessages).not.toHaveBeenCalled();
  });

  it("denies a guessed thread even when the reader owns the supplied chat", async () => {
    const { owner, args } = await fixture();
    await expect(
      owner.query(query, { ...args, threadId: "another-thread" })
    ).rejects.toMatchObject({
      data: { _tag: "ChatAccessError", code: "FORBIDDEN" },
    });
    expect(listUIMessages).not.toHaveBeenCalled();
  });

  it("resumes only deltas belonging to the authorized thread", async () => {
    const { t, owner, identity, args } = await fixture();
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
      refs.public.nina.messages.list,
      await owner.query(query, { ...args, streamArgs: { kind: "list" } })
    );
    expect(listed.streams).toEqual({
      kind: "list",
      messages: [expect.objectContaining({ streamId: streams.own })],
    });
    expect(listed.page).toEqual([]);
    const resumed = Ref.decodeReturnsSync(
      refs.public.nina.messages.list,
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
    expect(listUIMessages).not.toHaveBeenCalled();
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
      const { owner, args } = await fixture();
      await expect(
        owner.query(query, { ...args, streamArgs: { kind: "deltas", cursors } })
      ).rejects.toThrow();
      expect(listUIMessages).not.toHaveBeenCalled();
      expect(syncStreams).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["messages", undefined],
    ["streams", { kind: "deltas", cursors: [] }],
    ["cursors", { kind: "deltas", cursors: [] }],
    ["missing streams", { kind: "list" }],
  ] as const)("redacts %s transport failures", async (source, streamArgs) => {
    const { owner, args } = await fixture();
    const error = new Error("private transport diagnostic");
    if (source === "messages") {
      vi.mocked(listUIMessages).mockRejectedValueOnce(error);
    }
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
      owner.query(query, streamArgs ? { ...args, streamArgs } : args)
    ).rejects.toMatchObject({
      data: {
        _tag: "NinaReadError",
        message:
          source === "messages"
            ? "Unable to read Nina messages."
            : "Unable to read Nina streams.",
      },
    });
  });
});
