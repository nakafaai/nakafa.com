import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import { shareTokenValidator } from "@repo/backend/confect/chats/schema";
import { chatViewValidator } from "@repo/backend/confect/chats/view";
import Session from "@repo/backend/confect/middleware/session.spec";
import { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import { Schema } from "effect";

/** Who may read a conversation: its owner, or a reader with the token of its link. */
const access = {
  chatId: Id("chats"),
  shareToken: Schema.optionalKey(shareTokenValidator),
};

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      args: () => access,
      returns: () =>
        Schema.Struct({
          chat: chatViewValidator,
          turn: Schema.NullOr(NinaTurnSummary),
        }),
      error: () => Schema.Union([AuthFailure, ChatAccessError]),
    }).middleware(Session)
  )
  // The turns of a conversation that ended, newest first. A turn that still
  // runs is not among them: `get` tells it. A page holds at most
  // `NINA_MESSAGES_PAGE_SIZE` turns, which is as many as a page of messages
  // holds messages, and every turn has a message, so the page of turns that is
  // asked for with a page of messages holds the turns that one shows.
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "turns",
      args: () => access,
      item: () => NinaTurnSummary,
      error: () => Schema.Union([AuthFailure, ChatAccessError]),
    }).middleware(Session)
  );
