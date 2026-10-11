import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { ChatView } from "@repo/backend/confect/chats/view";
import {
  ensureLearnerKeys,
  readLearnerKeys,
} from "@repo/backend/confect/vault/keys";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { Effect, Predicate } from "effect";

type Chat = Docs["chats"];
type ReadKeys = ReturnType<typeof readLearnerKeys>;

/** The stored field a chat title is sealed for, besides its owner. */
export const CHAT_TITLE = { field: "title", table: "chats" } as const;

/**
 * Seals a chat title for the learner who owns the chat. The first seal of a
 * learner creates their key. A vault failure is a deployment defect, so it
 * dies instead of reaching the caller.
 */
export const sealTitle = Effect.fn("chats.title.seal")(function* (
  userId: Chat["userId"],
  title: string
) {
  return yield* sealText(yield* ensureLearnerKeys(userId), CHAT_TITLE, title);
}, Effect.orDie);

/**
 * Opens one stored title. A plain title, written before October 2026, comes
 * back as it is and needs no key. A sealed title opens with the owner's keys,
 * which `readKeys` reads on the first sealed title only.
 */
const openTitle = Effect.fn("chats.title.openTitle")(function* (
  readKeys: ReadKeys,
  stored: NonNullable<Chat["title"]>
) {
  if (Predicate.isString(stored)) {
    return stored;
  }
  return yield* openText(yield* readKeys, CHAT_TITLE, stored);
});

/** Opens the title of one chat and leaves a chat without a title as it is. */
const openRow = Effect.fn("chats.title.openRow")(function* (
  readKeys: ReadKeys,
  chat: Chat
) {
  const { title, ...rest } = chat;
  const opened: ChatView =
    title === undefined
      ? rest
      : { ...rest, title: yield* openTitle(readKeys, title) };
  return opened;
}, Effect.orDie);

/**
 * Opens the title of a chat for a reader the access rules already allow. A
 * public chat opens with its owner's keys, because the owner sealed it.
 */
export const openChat = Effect.fn("chats.title.openChat")(function* (
  chat: Chat
) {
  return yield* openRow(readLearnerKeys(chat.userId), chat);
});

/**
 * Opens the titles of chats that one learner owns. The learner's keys are read
 * once for the whole list, never once per chat.
 */
export const openChats = Effect.fn("chats.title.openChats")(function* (
  userId: Chat["userId"],
  chats: readonly Chat[]
) {
  const readKeys = yield* Effect.cached(readLearnerKeys(userId));
  return yield* Effect.forEach(chats, (chat) => openRow(readKeys, chat));
});
