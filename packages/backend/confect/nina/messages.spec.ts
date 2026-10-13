import { FunctionSpec, GroupSpec, PaginationOptions } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import { shareTokenValidator } from "@repo/backend/confect/chats/schema";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  AgentId,
  MessagePage,
  StreamRequest,
} from "@repo/backend/confect/nina/contract/message";
import { Schema } from "effect";

export class NinaReadError extends Schema.TaggedError<NinaReadError>()(
  "NinaReadError",
  { message: Schema.String }
) {}

// One page of a chat's messages, newest first. A page holds at most
// `NINA_MESSAGES_PAGE_SIZE` messages, however many the caller asks for. A
// request for streams holds no page. The thread and the streams a caller names
// are ids of the Agent component, which have a length (`AGENT_ID_LENGTH`).
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "list",
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
