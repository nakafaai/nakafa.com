import {
  FunctionSpec,
  GroupSpec,
  PaginationOptions,
  PaginationResult,
} from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import { shareTokenValidator } from "@repo/backend/confect/chats/schema";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  AgentId,
  AgentMessage,
  MessagePage,
  StreamRequest,
} from "@repo/backend/confect/nina/contract/message";
import { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import { Schema } from "effect";

export class NinaReadError extends Schema.TaggedError<NinaReadError>()(
  "NinaReadError",
  { message: Schema.String }
) {}

// Temporary compatibility for `list`. A browser tab opened before `page` was
// deployed still calls `list`, and it reads `metadata` on every turn but the
// latest. `list` keeps its arguments and its response exactly as they were.
// Owner: the pull request that adds `page` (nakafaai/nakafa.com #1044).
// Exit: no call of `nina/messages:list` for the 12-hour skew window after that
// deploy, read from the production logs.
// Cleanup: one change deletes `list`, its implementation, its tests, its
// bindings, and the schemas below that only `list` uses.

/** A message of `list`: the message as Agent lists it, with the turn it answers. */
const ListMessage = Schema.Struct({
  ...AgentMessage.fields,
  metadata: Schema.optional(NinaTurnSummary),
});

/** The stream request of `list`, which names streams by any text. */
const ListStreamRequest = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("list"),
    startOrder: Schema.optionalKey(
      Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal("deltas"),
    cursors: Schema.mutable(
      Schema.Array(
        Schema.Struct({
          streamId: Schema.String,
          cursor: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
        })
      ).check(Schema.isMaxLength(100))
    ),
  }),
]);

const ListPage = Schema.Struct({
  ...PaginationResult.PaginationResult(ListMessage).fields,
  streams: MessagePage.fields.streams,
});

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      args: () => ({
        chatId: Id("chats"),
        shareToken: Schema.optionalKey(shareTokenValidator),
        threadId: Schema.String,
        paginationOpts: PaginationOptions.PaginationOptions,
        streamArgs: Schema.optionalKey(ListStreamRequest),
      }),
      returns: () => ListPage,
      error: () => Schema.Union([AuthFailure, ChatAccessError, NinaReadError]),
    }).middleware(Session)
  )
  // One page of a chat's messages, newest first. A page holds at most
  // `NINA_MESSAGES_PAGE_SIZE` messages, however many the caller asks for. A
  // request for streams holds no page. The thread and the streams a caller names
  // are ids of the Agent component, which have a length (`AGENT_ID_LENGTH`).
  .addFunction(
    FunctionSpec.publicQuery({
      name: "page",
      args: () => ({
        chatId: Id("chats"),
        shareToken: Schema.optionalKey(shareTokenValidator),
        threadId: AgentId,
        paginationOpts: PaginationOptions.PaginationOptions,
        streamArgs: Schema.optionalKey(StreamRequest),
      }),
      returns: () => MessagePage,
      error: () => Schema.Union([AuthFailure, ChatAccessError, NinaReadError]),
    }).middleware(Session)
  );
