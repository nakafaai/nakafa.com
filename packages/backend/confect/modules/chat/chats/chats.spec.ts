import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  Chats,
  chatTypeSchema,
  chatVisibilitySchema,
  Messages,
  messageRoleSchema,
  modelIdSchema,
  Parts,
  partSchema,
} from "@repo/backend/confect/modules/chat/chats.tables";
import { Schema } from "effect";

/** Convex pagination options accepted by chat list and transcript queries. */
const paginationOptsSchema = Schema.Struct({
  cursor: Schema.Union(Schema.String, Schema.Null),
  endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  id: Schema.optional(Schema.Number),
  maximumBytesRead: Schema.optional(Schema.Number),
  maximumRowsRead: Schema.optional(Schema.Number),
  numItems: Schema.Number,
});

/** Convex pagination metadata returned with every chat page. */
const paginationFields = {
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  pageStatus: Schema.optional(
    Schema.Union(
      Schema.Literal("SplitRecommended"),
      Schema.Literal("SplitRequired"),
      Schema.Null
    )
  ),
  splitCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
};

/** Chat message fields accepted from the AI runtime. */
const chatMessageInputSchema = Schema.Struct({
  chatId: GenericId.GenericId("chats"),
  credits: Schema.optional(Schema.Number),
  identifier: Schema.String,
  inputTokens: Schema.optional(Schema.Number),
  modelId: modelIdSchema,
  outputTokens: Schema.optional(Schema.Number),
  role: messageRoleSchema,
  totalTokens: Schema.optional(Schema.Number),
});

/** First chat message fields accepted before a chat id exists. */
const firstChatMessageInputSchema = Schema.Struct({
  chatId: Schema.optional(GenericId.GenericId("chats")),
  credits: Schema.optional(Schema.Number),
  identifier: Schema.String,
  inputTokens: Schema.optional(Schema.Number),
  modelId: modelIdSchema,
  outputTokens: Schema.optional(Schema.Number),
  role: messageRoleSchema,
  totalTokens: Schema.optional(Schema.Number),
});

/** AI message part fields accepted before a message id and order are assigned. */
const messagePartInputSchema = partSchema.omit("messageId", "order");

/** Persisted message row with its ordered part rows. */
const messageWithPartsSchema = Schema.extend(
  Messages.Doc,
  Schema.Struct({ parts: Schema.Array(Parts.Doc) })
);

/** Paginated chat rows. */
const chatPageSchema = Schema.Struct({
  ...paginationFields,
  page: Schema.Array(Chats.Doc),
});

/** Paginated message rows with hydrated parts. */
const messagePageSchema = Schema.Struct({
  ...paginationFields,
  page: Schema.Array(messageWithPartsSchema),
});

const chatsMutationsGroup = GroupSpec.make("mutations")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createChat",
      args: Schema.Struct({
        title: Schema.optional(Schema.String),
        type: chatTypeSchema,
      }),
      returns: GenericId.GenericId("chats"),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createChatWithMessage",
      args: Schema.Struct({
        message: firstChatMessageInputSchema,
        parts: Schema.Array(messagePartInputSchema),
        title: Schema.optional(Schema.String),
        type: chatTypeSchema,
      }),
      returns: Schema.Struct({
        chatId: GenericId.GenericId("chats"),
        messageId: GenericId.GenericId("messages"),
        partIds: Schema.Array(GenericId.GenericId("parts")),
      }),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "deleteChat",
      args: Schema.Struct({ chatId: GenericId.GenericId("chats") }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "deleteMessageBatch",
      args: Schema.Struct({
        chatId: GenericId.GenericId("chats"),
        fromCreationTime: Schema.Number,
      }),
      returns: Schema.Struct({ hasMore: Schema.Boolean }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "saveAssistantResponse",
      args: Schema.Struct({
        message: chatMessageInputSchema,
        parts: Schema.Array(messagePartInputSchema),
        userId: GenericId.GenericId("users"),
      }),
      returns: Schema.Struct({
        credits: Schema.Number,
        messageId: GenericId.GenericId("messages"),
        newBalance: Schema.Number,
        partIds: Schema.Array(GenericId.GenericId("parts")),
      }),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "saveMessage",
      args: Schema.Struct({
        message: chatMessageInputSchema,
        parts: Schema.Array(messagePartInputSchema),
      }),
      returns: Schema.Struct({
        messageId: GenericId.GenericId("messages"),
        partIds: Schema.Array(GenericId.GenericId("parts")),
      }),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateChatTitle",
      args: Schema.Struct({
        chatId: GenericId.GenericId("chats"),
        title: Schema.String,
      }),
      returns: GenericId.GenericId("chats"),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateChatVisibility",
      args: Schema.Struct({
        chatId: GenericId.GenericId("chats"),
        visibility: chatVisibilitySchema,
      }),
      returns: GenericId.GenericId("chats"),
    })
  );

export { chatsMutationsGroup };

const chatsQueriesGroup = GroupSpec.make("queries")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getChat",
      args: Schema.Struct({ chatId: GenericId.GenericId("chats") }),
      returns: Chats.Doc,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getChats",
      args: Schema.Struct({
        paginationOpts: paginationOptsSchema,
        q: Schema.optional(Schema.String),
        type: Schema.optional(chatTypeSchema),
        userId: GenericId.GenericId("users"),
        visibility: Schema.optional(chatVisibilitySchema),
      }),
      returns: chatPageSchema,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getOwnChats",
      args: Schema.Struct({
        paginationOpts: paginationOptsSchema,
        q: Schema.optional(Schema.String),
        type: Schema.optional(chatTypeSchema),
        visibility: Schema.optional(chatVisibilitySchema),
      }),
      returns: chatPageSchema,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getChatTitle",
      args: Schema.Struct({ chatId: GenericId.GenericId("chats") }),
      returns: Schema.Union(Schema.Null, Schema.String),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "loadMessagesPage",
      args: Schema.Struct({
        chatId: GenericId.GenericId("chats"),
        paginationOpts: paginationOptsSchema,
      }),
      returns: messagePageSchema,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getMessageMatch",
      args: Schema.Struct({
        chatId: GenericId.GenericId("chats"),
        identifier: Schema.String,
      }),
      returns: Schema.Union(
        Schema.Null,
        Schema.Struct({
          creationTime: Schema.Number,
          messageId: GenericId.GenericId("messages"),
        })
      ),
    })
  );

export { chatsQueriesGroup };

const chatsActionsGroup = GroupSpec.make("actions").addFunction(
  FunctionSpec.publicAction({
    name: "scheduleSaveAssistantResponse",
    args: Schema.Struct({
      message: chatMessageInputSchema,
      parts: Schema.Array(messagePartInputSchema),
    }),
    returns: Schema.Null,
  })
);

export { chatsActionsGroup };

const chatsGroup = GroupSpec.make("chats")
  .addGroup(chatsMutationsGroup)
  .addGroup(chatsQueriesGroup)
  .addGroup(chatsActionsGroup);

export { chatsGroup };
