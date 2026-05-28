import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { scheduleSaveAssistantResponse as chatActions_scheduleSaveAssistantResponse } from "@repo/backend/confect/modules/chat/chatActions.service";
import {
  createChat as chatMutations_createChat,
  createChatWithMessage as chatMutations_createChatWithMessage,
  deleteChat as chatMutations_deleteChat,
  deleteMessageBatch as chatMutations_deleteMessageBatch,
  saveAssistantResponse as chatMutations_saveAssistantResponse,
  saveMessage as chatMutations_saveMessage,
  updateChatTitle as chatMutations_updateChatTitle,
  updateChatVisibility as chatMutations_updateChatVisibility,
} from "@repo/backend/confect/modules/chat/chatMutations.service";
import {
  getChat as chatQueries_getChat,
  getChats as chatQueries_getChats,
  getChatTitle as chatQueries_getChatTitle,
  getMessageMatch as chatQueries_getMessageMatch,
  getOwnChats as chatQueries_getOwnChats,
  loadMessagesPage as chatQueries_loadMessagesPage,
} from "@repo/backend/confect/modules/chat/chatQueries.service";
import { Layer } from "effect";

const chats_mutations_createChatImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "createChat",
  (args) => chatMutations_createChat(args)
);

const chats_mutations_createChatWithMessageImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "createChatWithMessage",
  (args) => chatMutations_createChatWithMessage(args)
);

const chats_mutations_deleteChatImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "deleteChat",
  (args) => chatMutations_deleteChat(args)
);

const chats_mutations_deleteMessageBatchImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "deleteMessageBatch",
  (args) => chatMutations_deleteMessageBatch(args)
);

const chats_mutations_saveAssistantResponseImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "saveAssistantResponse",
  (args) => chatMutations_saveAssistantResponse(args)
);

const chats_mutations_saveMessageImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "saveMessage",
  (args) => chatMutations_saveMessage(args)
);

const chats_mutations_updateChatTitleImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "updateChatTitle",
  (args) => chatMutations_updateChatTitle(args)
);

const chats_mutations_updateChatVisibilityImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "updateChatVisibility",
  (args) => chatMutations_updateChatVisibility(args)
);

const chats_queries_getChatImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "getChat",
  (args) => chatQueries_getChat(args)
);

const chats_queries_getChatsImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "getChats",
  (args) => chatQueries_getChats(args)
);

const chats_queries_getOwnChatsImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "getOwnChats",
  (args) => chatQueries_getOwnChats(args)
);

const chats_queries_getChatTitleImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "getChatTitle",
  (args) => chatQueries_getChatTitle(args)
);

const chats_queries_loadMessagesPageImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "loadMessagesPage",
  (args) => chatQueries_loadMessagesPage(args)
);

const chats_queries_getMessageMatchImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "getMessageMatch",
  (args) => chatQueries_getMessageMatch(args)
);

const chats_actions_scheduleSaveAssistantResponseImpl = FunctionImpl.make(
  api,
  "chats.actions",
  "scheduleSaveAssistantResponse",
  (args) => chatActions_scheduleSaveAssistantResponse(args)
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
