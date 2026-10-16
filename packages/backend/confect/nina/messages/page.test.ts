import { Ref } from "@confect/core";
import { listStreams, saveMessage, syncStreams } from "@convex-dev/agent";
import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import { NINA_MESSAGES_PAGE_SIZE } from "@repo/backend/client/nina/presentation";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { AGENT_ID_LENGTH } from "@repo/backend/confect/nina/contract/message";
import { readThread } from "@repo/backend/confect/nina/sealed/thread";
import { SealedReadError } from "@repo/backend/confect/nina/sealed.spec";
import { provider } from "@repo/backend/test/gateway";
import {
  createNinaTest,
  ninaModel,
  ninaStream,
  ninaUsage,
} from "@repo/backend/test/nina";
import { sealThreadIn, withoutRowIds } from "@repo/backend/test/nina/seal";
import {
  createThreadTest,
  MEMORY_TURN,
  SEARCH,
  SEARCHING_TURN,
} from "@repo/backend/test/nina/thread";
import { encodeJsonText } from "@repo/utilities/json";
import type { FunctionArgs } from "convex/server";
import { Array as Arr, Effect, Option, Schema } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));
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
const run = Ref.getFunctionReference(refs.internal.nina.response.run);
const share = Ref.getFunctionReference(
  refs.public.chats.mutations.updateChatVisibility
);
const token = Ref.getFunctionReference(refs.public.chats.queries.getShareToken);

type Fixture = Awaited<ReturnType<typeof createThreadTest>>;

/** The keys under which a part holds what the provider reported for a call, and the report's own key. */
const REPORTED = /[pP]roviderMetadata|convexGateway/;

/** Shares the chat of an owner, and returns the token of its link. */
async function shareChat(
  owner: Fixture["owner"],
  chatId: Fixture["args"]["chatId"]
) {
  await owner.mutation(share, { chatId, visibility: "public" });
  const shareToken = await owner.query(token, { chatId });
  assert(shareToken !== null);
  return shareToken;
}

/** Starts a stream on the thread of the chat, as a running turn does, and writes "Live" to it. */
function startStream(f: Fixture) {
  return f.t.mutation(async (ctx) => {
    const streamId = await ctx.runMutation(components.nina.streams.create, {
      threadId: f.identity.threadId,
      userId: f.identity.userId,
      order: 1,
      stepOrder: 0,
      format: "UIMessageChunk",
    });
    await ctx.runMutation(components.nina.streams.addDelta, {
      streamId,
      start: 0,
      end: 1,
      parts: [{ type: "text-delta", id: "text-1", delta: "Live" }],
    });
    return streamId;
  });
}

/** What a reader is told by one call of the query, as the page decodes it. */
async function tell(
  reader: Fixture["owner"],
  args: FunctionArgs<typeof query>
) {
  return Ref.decodeReturnsSync(
    refs.public.nina.messages.page,
    await reader.query(query, args)
  );
}

/** What a reader is told by the messages of the chat, by its live streams, and by the new parts of one. */
function askAll(
  reader: Fixture["owner"],
  f: Fixture,
  streamId: string,
  access: { shareToken?: string }
) {
  return Promise.all([
    tell(reader, { ...f.args, ...access }),
    tell(reader, { ...f.args, ...access, streamArgs: { kind: "list" } }),
    tell(reader, {
      ...f.args,
      ...access,
      streamArgs: { kind: "deltas", cursors: [{ streamId, cursor: 0 }] },
    }),
  ]);
}

const PartKinds = Schema.Array(Schema.Struct({ type: Schema.String }));

/** The kinds of the parts of the assistant's message in what a reader was told, in order. */
function kindsOf(told: Awaited<ReturnType<typeof tell>>) {
  const assistant = Arr.findFirst(
    told.page,
    ({ role }) => role === "assistant"
  );
  assert(Option.isSome(assistant));
  return Arr.map(
    Schema.decodeUnknownSync(PartKinds)(assistant.value.parts),
    ({ type }) => type
  );
}

describe("Nina message page", () => {
  afterEach(() => {
    vi.clearAllMocks();
    provider.languageModel.mockReset();
  });

  it("reads the component transcript with reasoning and tool artifacts intact", async () => {
    const { owner, args } = await createThreadTest();
    const page = Ref.decodeReturnsSync(
      refs.public.nina.messages.page,
      await owner.query(query, args)
    );
    expect(page.streams).toEqual({ kind: "list", messages: [] });
    const assistant = Option.getOrUndefined(
      Arr.findFirst(page.page, (message) => message.role === "assistant")
    );
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
      Arr.some(page.page, (message) => message.text === "Explain a limit.")
    ).toBe(true);
  });

  it("allows an anonymous reader with the share token and denies every other reader before touching the component", async () => {
    const shared = await createThreadTest();
    await shared.owner.mutation(share, {
      chatId: shared.args.chatId,
      visibility: "public",
    });
    const shareToken = await shared.owner.query(token, {
      chatId: shared.args.chatId,
    });
    assert(shareToken !== null);
    await expect(
      shared.t.query(query, { ...shared.args, shareToken })
    ).resolves.toHaveProperty("page");
    vi.clearAllMocks();
    // The chat id alone and the wrong token read like a chat that is not there.
    for (const refused of [{}, { shareToken: "A".repeat(43) }]) {
      await expect(
        shared.t.query(query, { ...shared.args, ...refused })
      ).rejects.toMatchObject({
        data: { _tag: "ChatAccessError", code: "CHAT_NOT_FOUND" },
      });
    }
    const privateChat = await createThreadTest();
    await expect(
      privateChat.t.query(query, privateChat.args)
    ).rejects.toMatchObject({
      data: { _tag: "ChatAccessError", code: "CHAT_NOT_FOUND" },
    });
    expect(readThread).not.toHaveBeenCalled();
  });

  it("cuts a page to the page size however many messages the caller asks for", async () => {
    const { t, owner, identity, args } = await createThreadTest();
    // The thread holds the messages of the fixture and a full page besides.
    await t.mutation(async (ctx) => {
      for (let n = 0; n < NINA_MESSAGES_PAGE_SIZE; n += 1) {
        const threadId = identity.threadId;
        await saveMessage(ctx, components.nina, { prompt: `Q${n}`, threadId });
      }
    });
    const paginationOpts = { cursor: null, numItems: 1_000_000 };
    const asked = await tell(owner, { ...args, paginationOpts });
    expect(asked.page).toHaveLength(NINA_MESSAGES_PAGE_SIZE);
    expect(asked.isDone).toBe(false);
  });

  it("denies a guessed thread even when the reader owns the supplied chat", async () => {
    const { owner, args } = await createThreadTest();
    await expect(
      owner.query(query, { ...args, threadId: "another-thread" })
    ).rejects.toMatchObject({
      data: { _tag: "ChatAccessError", code: "FORBIDDEN" },
    });
    expect(readThread).not.toHaveBeenCalled();
  });

  it("takes the id of a thread of the longest length and refuses a longer one before it reads anything", async () => {
    const { owner, args } = await createThreadTest();
    // The longest id passes the schema, and it is no thread of this chat.
    await expect(
      owner.query(query, {
        ...args,
        threadId: "x".repeat(AGENT_ID_LENGTH),
      })
    ).rejects.toMatchObject({
      data: { _tag: "ChatAccessError", code: "FORBIDDEN" },
    });
    await expect(
      owner.query(query, {
        ...args,
        threadId: "x".repeat(AGENT_ID_LENGTH + 1),
      })
    ).rejects.toMatchObject({
      _tag: "SchemaError",
      message: expect.stringContaining("threadId"),
    });
    expect(readThread).not.toHaveBeenCalled();
  });

  it("names the account that owns the chat in every message and live stream it tells the owner", async () => {
    const f = await createThreadTest();
    const streamId = await startStream(f);
    const [messages, streams, deltas] = await askAll(f.owner, f, streamId, {});
    for (const read of [messages, streams]) {
      expect(encodeJsonText(read)).toContain(f.identity.userId);
    }
    expect(encodeJsonText(streams)).toContain(streamId);
    expect(encodeJsonText(deltas)).toContain("Live");
  });

  it("tells a reader who holds the share link no live stream whatever it asks, reads none for it, and still lists the messages", async () => {
    const f = await createThreadTest();
    const streamId = await startStream(f);
    const shareToken = await shareChat(f.owner, f.args.chatId);
    vi.clearAllMocks();

    const [messages, streams, deltas] = await askAll(f.t, f, streamId, {
      shareToken,
    });

    // The two answers that Agent's hook reads as no stream: it lists none, so it
    // asks for no deltas, and a request for deltas gets none.
    expect(streams).toEqual({
      continueCursor: "",
      isDone: true,
      page: [],
      streams: { kind: "list", messages: [] },
    });
    expect(deltas).toEqual({
      continueCursor: "",
      isDone: true,
      page: [],
      streams: { kind: "deltas", deltas: [] },
    });
    // The component is not asked for a stream, so none is read and then hidden.
    expect(listStreams).not.toHaveBeenCalled();
    expect(syncStreams).not.toHaveBeenCalled();
    // The page of messages is the live query that tells a reader what is written.
    expect(messages.streams).toEqual({ kind: "list", messages: [] });
    expect(encodeJsonText(messages)).toContain("The value is 2.");
    for (const read of [messages, streams, deltas]) {
      expect(encodeJsonText(read)).not.toContain(f.identity.userId);
      expect(encodeJsonText(read)).not.toContain(streamId);
      expect(encodeJsonText(read)).not.toContain("Live");
    }
  });

  it("tells a reader no part of a search of the owner's memory, and the owner all of it", async () => {
    const f = await createThreadTest(MEMORY_TURN);
    const shareToken = await shareChat(f.owner, f.args.chatId);
    const ownerTold = await tell(f.owner, { ...f.args });
    const ownerByLink = await tell(f.owner, { ...f.args, shareToken });
    const readerTold = await tell(f.t, { ...f.args, shareToken });

    // The owner is told every part, by the chat id and through their own link.
    const everything = [
      "reasoning",
      "step-start",
      "tool-math",
      "step-start",
      "tool-memory",
      "text",
    ];
    expect(kindsOf(ownerTold)).toEqual(everything);
    expect(kindsOf(ownerByLink)).toEqual(everything);
    // A reader is told the rest, and neither the search nor the marker Agent
    // writes in front of it: the marker of the sum stays where it was.
    expect(kindsOf(readerTold)).toEqual([
      "reasoning",
      "step-start",
      "tool-math",
      "text",
    ]);
    // None of what the search holds is on the wire to a reader.
    for (const words of [SEARCH.id, SEARCH.query, SEARCH.text]) {
      expect(encodeJsonText(ownerTold)).toContain(words);
      expect(encodeJsonText(readerTold)).not.toContain(words);
    }
    expect(encodeJsonText(readerTold)).not.toContain("tool-memory");
    expect(encodeJsonText(readerTold)).toContain("The value is 2.");
  });

  it("keeps the message of a turn that has only searched the memory, with no part, for a reader", async () => {
    const f = await createThreadTest(SEARCHING_TURN);
    const shareToken = await shareChat(f.owner, f.args.chatId);
    const ownerTold = await tell(f.owner, { ...f.args });
    const readerTold = await tell(f.t, { ...f.args, shareToken });

    expect(kindsOf(ownerTold)).toEqual(["step-start", "tool-memory"]);
    // The answer is still listed, as the empty answer the page shows as Nina
    // typing, and holds nothing of the search.
    expect(Arr.map(readerTold.page, ({ role }) => role)).toEqual([
      "user",
      "assistant",
    ]);
    expect(kindsOf(readerTold)).toEqual([]);
    expect(encodeJsonText(readerTold)).not.toContain(SEARCH.query);
  });

  it("tells a reader nothing of what the gateway reported for the calls of a turn that ran, under any key, and tells the owner all of it", async () => {
    // A cost that no other number of a page holds.
    const cost = 0.123_456;
    const languageModel = ninaModel();
    languageModel.doStream = () =>
      Promise.resolve(
        ninaStream([
          { type: "stream-start", warnings: [] },
          { type: "reasoning-start", id: "reason" },
          { type: "reasoning-delta", id: "reason", delta: "Check it." },
          { type: "reasoning-end", id: "reason" },
          { type: "text-start", id: "answer" },
          { type: "text-delta", id: "answer", delta: "An answer." },
          { type: "text-end", id: "answer" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            providerMetadata: { convexGateway: { cost } },
            usage: ninaUsage,
          },
        ])
      );
    provider.languageModel.mockReturnValue(languageModel);
    const f = await createNinaTest({ prompt: "Explain a function limit." });
    await f.t.action(run, { turnId: f.turnId });
    const shareToken = await shareChat(f.owner, f.chatId);
    const args = {
      chatId: f.chatId,
      paginationOpts: { cursor: null, numItems: 20 },
      threadId: f.threadId,
    };

    const ownerTold = await tell(f.owner, args);
    const readerTold = await tell(f.t, { ...args, shareToken });

    // The turn ran and Agent stored the report on what it wrote: the owner is
    // told it. A reader is told the reasoning and the answer, and the report
    // under no key.
    expect(encodeJsonText(ownerTold)).toContain(String(cost));
    expect(kindsOf(readerTold)).toEqual(["reasoning", "text"]);
    expect(encodeJsonText(readerTold)).toContain("An answer.");
    expect(encodeJsonText(readerTold)).not.toContain(String(cost));
    expect(encodeJsonText(readerTold)).not.toMatch(REPORTED);
  });

  it("gives the owner the same page of a sealed thread as of the plain thread, with every row opened", async () => {
    const { t, owner, identity, args } = await createThreadTest();
    const plain = await owner.query(query, args);
    await sealThreadIn(t, identity.threadId, identity.userId);
    const sealed = await owner.query(query, args);
    expect(withoutRowIds(sealed)).toEqual(withoutRowIds(plain));
    expect(encodeJsonText(sealed)).toContain("Check the expression.");
  });

  it("redacts a transport failure of the messages", async () => {
    const { owner, args } = await createThreadTest();
    vi.mocked(readThread).mockReturnValueOnce(
      Effect.fail(new SealedReadError())
    );
    await expect(owner.query(query, args)).rejects.toMatchObject({
      data: { _tag: "NinaReadError", message: "Unable to read Nina messages." },
    });
  });
});
