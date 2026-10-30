import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** What a fan-out notifies a class of: a message that mentions everyone, an announcement, or a new task. */
export const FanoutSource = Schema.Union([
  Schema.TaggedStruct("mention", { messageId: Id("classroomMessages") }),
  Schema.TaggedStruct("post", { postId: Id("classroomPosts") }),
  Schema.TaggedStruct("task", { taskId: Id("classroomTasks") }),
]);

/** The part of the class roster one run reads: the students placed in its cohort, then its subject teachers. */
export const FanoutPhase = Schema.Literals(["students", "teachers"]);

/**
 * Writes the inbox rows of one notice for a whole class, one batch of the roster
 * per run, never in one transaction (ADR 0027). It is internal: the message or
 * the announcement schedules its first run in its own transaction.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "run",
    args: () => ({
      cursor: Schema.NullOr(Schema.String),
      phase: FanoutPhase,
      source: FanoutSource,
    }),
    returns: () => Schema.Null,
  })
);
