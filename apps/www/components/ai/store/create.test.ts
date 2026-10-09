import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { defaultModel, ModelId } from "@repo/backend/confect/gateway/model";
import { encodeJsonText } from "@repo/utilities/json";
import { Record as Rec, Schema } from "effect";
import { createAiStore } from "@/components/ai/store/create";

const STORAGE_KEY = "nakafa-ai";
const StoredAiState = Schema.fromJsonString(
  Schema.Struct({
    state: Schema.Record(Schema.String, Schema.Unknown),
    version: Schema.Number,
  })
);
const chatId = Schema.decodeUnknownSync(Id("chats"))("chat_1");
const otherChatId = Schema.decodeUnknownSync(Id("chats"))("chat_2");
const otherModel = ModelId.make("nakafa-pro");
const receipt = {
  chatId,
  order: 0,
  prompt: { files: [], text: "Explain this step" },
  promptMessageId: "message_1",
  threadId: "thread_1",
  turnId: Schema.decodeUnknownSync(Id("ninaTurns"))("turn_1"),
};

describe("ai/store/create", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("starts with a closed sheet, no chat, and the default model", () => {
    const store = createAiStore();

    expect(store.getState()).toMatchObject({
      activeChatId: null,
      ask: null,
      chatDrafts: [],
      contextTitle: null,
      model: defaultModel,
      open: false,
      openingChat: null,
      sheetActivated: false,
      text: "",
    });
    expect(store.getState().getModel()).toBe(defaultModel);
  });

  it("admits one ask at a time and opens the sheet for it", () => {
    const store = createAiStore();

    expect(store.getState().openAsk({ id: "ask-1", text: "Explain" })).toBe(
      true
    );
    expect(store.getState()).toMatchObject({
      activeChatId: null,
      ask: { id: "ask-1", text: "Explain" },
      open: true,
      sheetActivated: true,
    });
    expect(store.getState().openAsk({ id: "ask-2", text: "Again" })).toBe(
      false
    );
    expect(store.getState().ask?.id).toBe("ask-1");
  });

  it("refuses an ask while a composer draft holds the new-chat slot", () => {
    const store = createAiStore();
    const listener = vi.fn();
    store.getState().addChatDraft("draft-1");
    const before = store.getState();
    store.subscribe(listener);

    expect(store.getState().openAsk({ id: "ask-1", text: "Explain" })).toBe(
      false
    );
    expect(store.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps the reference of every part an admitted ask did not change", () => {
    const store = createAiStore();
    store.getState().setText("Half typed");
    const { chatDrafts, contextTitle, model, text } = store.getState();

    store.getState().openAsk({ id: "ask-1", text: "Explain" });

    const next = store.getState();
    expect(next.chatDrafts).toBe(chatDrafts);
    expect(next.contextTitle).toBe(contextTitle);
    expect(next.model).toBe(model);
    expect(next.text).toBe(text);
  });

  it("prepends composer drafts and removes them by key", () => {
    const store = createAiStore();

    store.getState().addChatDraft("draft-1");
    store.getState().addChatDraft("draft-2");
    expect(store.getState().chatDrafts).toEqual(["draft-2", "draft-1"]);

    store.getState().removeChatDraft("draft-2");
    expect(store.getState().chatDrafts).toEqual(["draft-1"]);

    store.getState().removeChatDraft("missing");
    expect(store.getState().chatDrafts).toEqual(["draft-1"]);
  });

  it("keeps the pending ask when composer drafts change", () => {
    const store = createAiStore();
    store.getState().openAsk({ id: "ask-1", text: "Explain" });
    const { ask } = store.getState();

    store.getState().addChatDraft("draft-1");
    expect(store.getState().ask).toBe(ask);

    store.getState().removeChatDraft("draft-1");
    expect(store.getState().ask).toBe(ask);
  });

  it("clears the ask only for the id that resolves it", () => {
    const store = createAiStore();
    const listener = vi.fn();

    store.getState().resolveAsk("ask-1", chatId);
    expect(store.getState()).toMatchObject({ activeChatId: null, ask: null });

    store.getState().openAsk({ id: "ask-1", text: "Explain" });
    const before = store.getState();
    store.subscribe(listener);

    store.getState().resolveAsk("ask-2", chatId);
    expect(store.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();

    store.getState().resolveAsk("ask-1", chatId);
    expect(store.getState()).toMatchObject({ activeChatId: chatId, ask: null });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("opens the admitted chat only while no other chat is active", () => {
    const store = createAiStore();
    store.getState().openAsk({ id: "ask-1", text: "Explain" });
    store.getState().setActiveChatId(otherChatId);

    store.getState().resolveAsk("ask-1", chatId);

    expect(store.getState()).toMatchObject({
      activeChatId: otherChatId,
      ask: null,
    });
  });

  it("resolves an ask without a chat id and opens no chat", () => {
    const store = createAiStore();
    store.getState().openAsk({ id: "ask-1", text: "Explain" });

    store.getState().resolveAsk("ask-1", null);

    expect(store.getState()).toMatchObject({ activeChatId: null, ask: null });
  });

  it("moves a resolved composer draft into the chat that is opening", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T08:00:00Z"));
    const store = createAiStore();
    store.getState().addChatDraft("draft-1");
    store.getState().addChatDraft("draft-2");
    const { model, text } = store.getState();

    store.getState().resolveChatDraft("draft-1", receipt);

    expect(store.getState()).toMatchObject({
      chatDrafts: ["draft-2"],
      openingChat: {
        prompt: receipt.prompt,
        receipt,
        submittedAt: new Date("2026-10-09T08:00:00Z").getTime(),
      },
    });
    expect(store.getState().model).toBe(model);
    expect(store.getState().text).toBe(text);
  });

  it("ignores a resolution for a draft that is no longer pending", () => {
    const store = createAiStore();
    const listener = vi.fn();
    store.getState().addChatDraft("draft-1");
    const before = store.getState();
    store.subscribe(listener);

    store.getState().resolveChatDraft("missing", receipt);

    expect(store.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it("sets the chat, title, model, and opening chat without touching the drafts", () => {
    const store = createAiStore();
    store.getState().addChatDraft("draft-1");
    const { chatDrafts } = store.getState();

    store.getState().setActiveChatId(chatId);
    store.getState().setContextTitle("Algebra");
    store.getState().setModel(otherModel);
    store.getState().setOpeningChat({
      prompt: receipt.prompt,
      receipt,
      submittedAt: 1,
    });

    expect(store.getState()).toMatchObject({
      activeChatId: chatId,
      contextTitle: "Algebra",
      model: otherModel,
      openingChat: { submittedAt: 1 },
    });
    expect(store.getState().getModel()).toBe(otherModel);
    expect(store.getState().chatDrafts).toBe(chatDrafts);

    store.getState().setActiveChatId(null);
    store.getState().setOpeningChat(null);
    expect(store.getState()).toMatchObject({
      activeChatId: null,
      openingChat: null,
    });
  });

  it("opens the sheet and keeps it activated after it closes", () => {
    const store = createAiStore();

    store.getState().setOpen(false);
    expect(store.getState()).toMatchObject({
      open: false,
      sheetActivated: false,
    });

    store.getState().setOpen(true);
    expect(store.getState()).toMatchObject({
      open: true,
      sheetActivated: true,
    });

    store.getState().setOpen(false);
    expect(store.getState()).toMatchObject({
      open: false,
      sheetActivated: true,
    });
  });

  it("sets the composer text from a value or from an updater", () => {
    const store = createAiStore();
    store.getState().openAsk({ id: "ask-1", text: "Explain" });
    const { ask } = store.getState();

    store.getState().setText("Explain");
    expect(store.getState().text).toBe("Explain");

    store.getState().setText((previous) => `${previous} this step`);
    expect(store.getState().text).toBe("Explain this step");
    expect(store.getState().ask).toBe(ask);
  });

  it("persists only the active chat under the Nina storage key", () => {
    const store = createAiStore();

    store.getState().setActiveChatId(chatId);
    store.getState().setText("Not persisted");

    const stored = Schema.decodeUnknownSync(StoredAiState)(
      localStorage.getItem(STORAGE_KEY)
    );
    expect(stored.version).toBe(1);
    expect(Rec.keys(stored.state)).toEqual(["activeChatId"]);
    expect(stored.state.activeChatId).toBe(chatId);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("restores the persisted chat when the store is created", () => {
    localStorage.setItem(
      STORAGE_KEY,
      encodeJsonText({ state: { activeChatId: chatId }, version: 1 })
    );

    const store = createAiStore();

    expect(store.getState()).toMatchObject({
      activeChatId: chatId,
      model: defaultModel,
      open: false,
    });
  });

  it("ignores persisted state from another version", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    localStorage.setItem(
      STORAGE_KEY,
      encodeJsonText({ state: { activeChatId: chatId }, version: 0 })
    );

    const store = createAiStore();

    expect(store.getState().activeChatId).toBeNull();
  });
});
