import type { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { ChatView } from "@repo/backend/confect/chats/view";
import type { NinaPageInput } from "@repo/backend/confect/nina/turns.spec";
import type { FileUIPart } from "ai";
import { Array as Arr, HashMap, Option, Schema } from "effect";
import { optimisticPrompt } from "@/components/ai/optimistic";
import { createLocalStore } from "@/test/optimistic";

type SavedMessage = Ref.Returns<typeof nina.messages.page>["page"][number];

const NOW = 1_700_000_000_000;
const chatId = Schema.decodeUnknownSync(Id("chats"))("chat_1");
const otherChatId = Schema.decodeUnknownSync(Id("chats"))("chat_2");
const userId = Schema.decodeUnknownSync(Id("users"))("user_1");
const uploadId = Schema.decodeUnknownSync(Id("ninaUploads"))("upload_1");
const missingUploadId = Schema.decodeUnknownSync(Id("ninaUploads"))("upload_2");
/** 43 URL-safe characters, the shape of a share token. */
const shareToken = "abcdefghijklmnopqrstuvwxyz0123456789-_ABCDE";

const chat = {
  _creationTime: 1,
  _id: chatId,
  threadId: "thread_1",
  title: "Limits",
  type: "study",
  updatedAt: 1,
  userId,
  visibility: "private",
} satisfies ChatView;

const preview = {
  filename: "graph.png",
  mediaType: "image/png",
  type: "file",
  url: "blob:graph",
} satisfies FileUIPart;
const previews = HashMap.make([uploadId, preview]);

const page: typeof NinaPageInput.Type = { locale: "en", slug: "/subjects" };

const sendArgs: Ref.Args<typeof nina.turns.start> = {
  chatId,
  input: {
    kind: "message",
    page,
    prompt: {
      text: "And a derivative?",
      uploadIds: [uploadId, missingUploadId],
    },
  },
  requestId: "request_1",
};

/** One saved message of the Agent feed, in the shape `nina.messages.page` returns. */
function message(
  order: number,
  role: SavedMessage["role"],
  text: string
): SavedMessage {
  return {
    _creationTime: order,
    id: `message_${order}_${role}`,
    key: `thread_1-${order}-0`,
    order,
    parts: [{ text, type: "text" }],
    role,
    status: "success",
    stepOrder: 0,
    text,
  };
}

/** The arguments of one `nina.messages.page` subscription. */
function listArgs(
  overrides: {
    chatId?: typeof chatId;
    cursor?: string | null;
    shareToken?: string;
    streamed?: boolean;
    threadId?: string;
  } = {}
): Ref.Args<typeof nina.messages.page> {
  return {
    chatId: overrides.chatId ?? chatId,
    paginationOpts: { cursor: overrides.cursor ?? null, numItems: 50 },
    ...(overrides.shareToken === undefined
      ? {}
      : { shareToken: overrides.shareToken }),
    ...(overrides.streamed
      ? { streamArgs: { kind: "list", startOrder: 0 } }
      : {}),
    threadId: overrides.threadId ?? "thread_1",
  };
}

/** One saved page of the Agent feed, newest message first as the server sends it. */
function listPage(
  messages: readonly SavedMessage[]
): Ref.Returns<typeof nina.messages.page> {
  return {
    continueCursor: "",
    isDone: true,
    page: Arr.reverse(messages),
    streams: { kind: "list", messages: [] },
  };
}

/** The loaded messages of one subscription, as the store holds them now. */
function readPage(
  local: ReturnType<typeof createLocalStore>,
  args: Ref.Args<typeof nina.messages.page>
) {
  return Option.getOrUndefined(local.store.getQuery(nina.messages.page, args))
    ?.page;
}

/** A chat with one saved exchange, loaded the way the sheet loads it. */
function loadedChat() {
  const local = createLocalStore();
  local.seed(nina.conversation.get, { chatId }, { chat, turn: null });
  local.seed(
    nina.messages.page,
    listArgs(),
    listPage([
      message(0, "user", "What is a limit?"),
      message(1, "assistant", "A limit is the value a function approaches."),
    ])
  );
  return local;
}

describe("ai/optimistic prompt", () => {
  it("shows the sent prompt first on the chat's loaded page", () => {
    const local = loadedChat();

    optimisticPrompt(previews, NOW)(local.store, sendArgs);

    const [pending, ...saved] = readPage(local, listArgs()) ?? [];
    expect(pending).toMatchObject({
      _creationTime: NOW,
      id: "request_1",
      key: "thread_1-2-0",
      order: 2,
      role: "user",
      status: "pending",
      stepOrder: 0,
      text: "And a derivative?",
    });
    // The saved messages follow it untouched, so dropping the prompt restores them.
    expect(saved).toEqual(readPage(loadedChat(), listArgs()));
    expect(local.written()).toHaveLength(1);
  });

  it("adds the preview of an uploaded file and skips an upload without one", () => {
    const local = loadedChat();

    optimisticPrompt(previews, NOW)(local.store, sendArgs);

    expect(readPage(local, listArgs())?.[0]?.parts).toEqual([
      { text: "And a derivative?", type: "text" },
      preview,
    ]);
  });

  it("sends a prompt with no uploads as its text alone", () => {
    const local = loadedChat();

    optimisticPrompt(previews, NOW)(local.store, {
      ...sendArgs,
      input: { kind: "message", page, prompt: { text: "No files" } },
    });

    expect(readPage(local, listArgs())?.[0]?.parts).toEqual([
      { text: "No files", type: "text" },
    ]);
  });

  it("writes only the first pages of this chat's own thread", () => {
    const local = loadedChat();
    const older = listArgs({ cursor: "cursor_1" });
    local.seed(
      nina.messages.page,
      older,
      listPage([message(0, "user", "Old")])
    );
    local.seed(nina.messages.page, listArgs({ streamed: true }), listPage([]));
    local.seed(
      nina.messages.page,
      listArgs({ threadId: "thread_2" }),
      listPage([])
    );
    local.seed(
      nina.messages.page,
      listArgs({ chatId: otherChatId }),
      listPage([])
    );

    optimisticPrompt(previews, NOW)(local.store, sendArgs);

    expect(local.written()).toHaveLength(1);
    expect(readPage(local, older)).toHaveLength(1);
  });

  it("shows the prompt in a chat the owner opened through its own share link", () => {
    const local = createLocalStore();
    // The send names the chat id alone, while the page holds the chat under the token.
    local.seed(
      nina.conversation.get,
      { chatId, shareToken },
      { chat, turn: null }
    );
    local.seed(
      nina.messages.page,
      listArgs({ shareToken }),
      listPage([message(0, "user", "What is a limit?")])
    );

    optimisticPrompt(previews, NOW)(local.store, sendArgs);

    expect(readPage(local, listArgs({ shareToken }))?.[0]).toMatchObject({
      id: "request_1",
      key: "thread_1-1-0",
      order: 1,
      status: "pending",
      text: "And a derivative?",
    });
  });

  it("leaves a first page that is still loading alone", () => {
    const local = createLocalStore();
    local.seed(nina.conversation.get, { chatId }, { chat, turn: null });
    local.seed(nina.messages.page, listArgs(), undefined);

    optimisticPrompt(previews, NOW)(local.store, sendArgs);

    expect(local.written()).toEqual([]);
  });

  it("numbers the first prompt of a chat from zero", () => {
    const local = createLocalStore();
    local.seed(nina.conversation.get, { chatId }, { chat, turn: null });
    local.seed(nina.messages.page, listArgs(), listPage([]));

    optimisticPrompt(previews, NOW)(local.store, sendArgs);

    expect(readPage(local, listArgs())?.[0]).toMatchObject({
      key: "thread_1-0-0",
      order: 0,
    });
  });

  it("writes nothing for a new chat or a chat that is not loaded", () => {
    const local = loadedChat();
    const unloaded = createLocalStore();

    optimisticPrompt(previews, NOW)(local.store, {
      input: sendArgs.input,
      requestId: sendArgs.requestId,
    });
    optimisticPrompt(previews, NOW)(unloaded.store, sendArgs);

    expect(local.written()).toEqual([]);
    expect(unloaded.written()).toEqual([]);
  });

  it("shows the prompt that a retry sends again", () => {
    const local = loadedChat();

    optimisticPrompt(previews, NOW)(local.store, {
      chatId,
      input: { kind: "retry", order: 0 },
      requestId: "request_2",
    });

    expect(readPage(local, listArgs())?.[0]).toMatchObject({
      id: "request_2",
      order: 2,
      parts: [{ text: "What is a limit?", type: "text" }],
      status: "pending",
      text: "What is a limit?",
    });
  });

  it("writes nothing for a retry whose prompt is not loaded", () => {
    const local = loadedChat();

    // Order 1 holds the answer, order 7 holds nothing.
    for (const order of [1, 7]) {
      optimisticPrompt(previews, NOW)(local.store, {
        chatId,
        input: { kind: "retry", order },
        requestId: `request_${order}`,
      });
    }

    expect(local.written()).toEqual([]);
  });

  it("gives the same pages when Confect replays it on the same data", () => {
    const first = loadedChat();
    const replay = loadedChat();

    optimisticPrompt(previews, NOW)(first.store, sendArgs);
    optimisticPrompt(previews, NOW)(replay.store, sendArgs);

    expect(readPage(replay, listArgs())).toEqual(readPage(first, listArgs()));
  });
});
