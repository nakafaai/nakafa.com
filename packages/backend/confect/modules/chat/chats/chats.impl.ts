import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { scheduleSaveAssistantResponse } from "@repo/backend/confect/modules/chat/chatActions.service";
import {
  createChat,
  createChatWithMessage,
  deleteChat,
  deleteMessageBatch,
  saveAssistantResponse,
  saveMessage,
  updateChatTitle,
  updateChatVisibility,
} from "@repo/backend/confect/modules/chat/chatMutations.service";
import {
  getChat,
  getChats,
  getChatTitle,
  getMessageMatch,
  getOwnChats,
  loadMessagesPage,
} from "@repo/backend/confect/modules/chat/chatQueries.service";
import { Effect, Layer } from "effect";

const chats_mutations_createChatImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "createChat",
  (args) => createChat(args).pipe(Effect.orDie)
);

const chats_mutations_createChatWithMessageImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "createChatWithMessage",
  (args) => createChatWithMessage(args).pipe(Effect.orDie)
);

const chats_mutations_deleteChatImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "deleteChat",
  (args) => deleteChat(args).pipe(Effect.orDie)
);

const chats_mutations_deleteMessageBatchImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "deleteMessageBatch",
  (args) => deleteMessageBatch(args).pipe(Effect.orDie)
);

const chats_mutations_saveAssistantResponseImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "saveAssistantResponse",
  (args) => saveAssistantResponse(args).pipe(Effect.orDie)
);

const chats_mutations_saveMessageImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "saveMessage",
  (args) => saveMessage(args).pipe(Effect.orDie)
);

const chats_mutations_updateChatTitleImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "updateChatTitle",
  (args) => updateChatTitle(args).pipe(Effect.orDie)
);

const chats_mutations_updateChatVisibilityImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "updateChatVisibility",
  (args) => updateChatVisibility(args).pipe(Effect.orDie)
);

const chats_queries_getChatImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "getChat",
  (args) => getChat(args).pipe(Effect.orDie)
);

const chats_queries_getChatsImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "getChats",
  (args) => getChats(args).pipe(Effect.orDie)
);

const chats_queries_getOwnChatsImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "getOwnChats",
  (args) => getOwnChats(args).pipe(Effect.orDie)
);

const chats_queries_getChatTitleImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "getChatTitle",
  (args) => getChatTitle(args).pipe(Effect.orDie)
);

const chats_queries_loadMessagesPageImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "loadMessagesPage",
  (args) => loadMessagesPage(args).pipe(Effect.orDie)
);

const chats_queries_getMessageMatchImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "getMessageMatch",
  (args) => getMessageMatch(args).pipe(Effect.orDie)
);

const chats_actions_scheduleSaveAssistantResponseImpl = FunctionImpl.make(
  api,
  "chats.actions",
  "scheduleSaveAssistantResponse",
  (args) => scheduleSaveAssistantResponse(args).pipe(Effect.orDie)
);

const chatsActionsImpl = GroupImpl.make(api, "chats.actions").pipe(
  Layer.provide(chats_actions_scheduleSaveAssistantResponseImpl)
);

const chatsMutationsImpl = GroupImpl.make(api, "chats.mutations")
  .pipe(Layer.provide(chats_mutations_createChatImpl))
  .pipe(Layer.provide(chats_mutations_createChatWithMessageImpl))
  .pipe(Layer.provide(chats_mutations_deleteChatImpl))
  .pipe(Layer.provide(chats_mutations_deleteMessageBatchImpl))
  .pipe(Layer.provide(chats_mutations_saveAssistantResponseImpl))
  .pipe(Layer.provide(chats_mutations_saveMessageImpl))
  .pipe(Layer.provide(chats_mutations_updateChatTitleImpl))
  .pipe(Layer.provide(chats_mutations_updateChatVisibilityImpl));

const chatsQueriesImpl = GroupImpl.make(api, "chats.queries")
  .pipe(Layer.provide(chats_queries_getChatImpl))
  .pipe(Layer.provide(chats_queries_getChatsImpl))
  .pipe(Layer.provide(chats_queries_getOwnChatsImpl))
  .pipe(Layer.provide(chats_queries_getChatTitleImpl))
  .pipe(Layer.provide(chats_queries_loadMessagesPageImpl))
  .pipe(Layer.provide(chats_queries_getMessageMatchImpl));

const chatsImpl = GroupImpl.make(api, "chats")
  .pipe(Layer.provide(chatsActionsImpl))
  .pipe(Layer.provide(chatsMutationsImpl))
  .pipe(Layer.provide(chatsQueriesImpl));

export const chatsLayer = Layer.mergeAll(chatsImpl);
