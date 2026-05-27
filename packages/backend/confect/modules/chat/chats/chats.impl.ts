import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as chat_actions from "@repo/backend/confect/modules/chat/chatActions.service";
import * as chat_mutations from "@repo/backend/confect/modules/chat/chatMutations.service";
import * as chat_queries from "@repo/backend/confect/modules/chat/chatQueries.service";
import { Layer } from "effect";

const chats_mutations_createChatImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "createChat",
  (args) => chat_mutations.createChat(args)
);

const chats_mutations_createChatWithMessageImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "createChatWithMessage",
  (args) => chat_mutations.createChatWithMessage(args)
);

const chats_mutations_deleteChatImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "deleteChat",
  (args) => chat_mutations.deleteChat(args)
);

const chats_mutations_deleteMessageBatchImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "deleteMessageBatch",
  (args) => chat_mutations.deleteMessageBatch(args)
);

const chats_mutations_saveAssistantResponseImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "saveAssistantResponse",
  (args) => chat_mutations.saveAssistantResponse(args)
);

const chats_mutations_saveMessageImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "saveMessage",
  (args) => chat_mutations.saveMessage(args)
);

const chats_mutations_updateChatTitleImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "updateChatTitle",
  (args) => chat_mutations.updateChatTitle(args)
);

const chats_mutations_updateChatVisibilityImpl = FunctionImpl.make(
  api,
  "chats.mutations",
  "updateChatVisibility",
  (args) => chat_mutations.updateChatVisibility(args)
);

const chats_queries_getChatImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "getChat",
  (args) => chat_queries.getChat(args)
);

const chats_queries_getChatsImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "getChats",
  (args) => chat_queries.getChats(args)
);

const chats_queries_getOwnChatsImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "getOwnChats",
  (args) => chat_queries.getOwnChats(args)
);

const chats_queries_getChatTitleImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "getChatTitle",
  (args) => chat_queries.getChatTitle(args)
);

const chats_queries_loadMessagesPageImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "loadMessagesPage",
  (args) => chat_queries.loadMessagesPage(args)
);

const chats_queries_getMessageMatchImpl = FunctionImpl.make(
  api,
  "chats.queries",
  "getMessageMatch",
  (args) => chat_queries.getMessageMatch(args)
);

const chats_actions_scheduleSaveAssistantResponseImpl = FunctionImpl.make(
  api,
  "chats.actions",
  "scheduleSaveAssistantResponse",
  (args) => chat_actions.scheduleSaveAssistantResponse(args)
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
