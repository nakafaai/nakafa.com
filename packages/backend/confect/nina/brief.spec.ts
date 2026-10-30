import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  NinaLearner,
  NinaMemoryTopics,
} from "@repo/backend/confect/nina/memory.spec";
import {
  NinaSummaryView,
  NinaUncoveredTurn,
  TurnOrder,
} from "@repo/backend/confect/nina/summaries.spec";
import { Schema } from "effect";

/**
 * What a run reads of a learner and a chat before it calls the model, in one
 * read: whether the learner connected Google Calendar (`calendar`), what the turn
 * knows about the learner (`learner`), the chat's rolling summary (`summary`),
 * and the newest complete turns the summary does not cover (`uncovered`), which
 * the history is built from.
 */
const NinaBrief = Schema.Struct({
  calendar: Schema.Boolean,
  learner: NinaLearner,
  summary: Schema.NullOr(NinaSummaryView),
  uncovered: Schema.Array(NinaUncoveredTurn),
});

export default GroupSpec.make().addFunction(
  // The brief of the turn at `order` of a chat. `now` is the caller's time and
  // `topics` are the pages the learner has open: a query never reads the clock,
  // because it is not run again when time passes. The learner's words are read
  // from the message that opened the turn, in the same read.
  FunctionSpec.internalQuery({
    name: "read",
    args: () => ({
      chatId: Id("chats"),
      now: Schema.Finite,
      order: TurnOrder,
      promptMessageId: Schema.String,
      topics: NinaMemoryTopics,
      userId: Id("users"),
    }),
    returns: () => NinaBrief,
  })
);
