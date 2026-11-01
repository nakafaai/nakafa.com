import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { NinaAsk } from "@repo/backend/confect/classroom/forum/nina";
import { Schema } from "effect";

/**
 * Nina's reply in a class forum (ADR 0025): `@Nina` in a message schedules `reply`. `begin` holds the credits and reads
 * what she needs, the model answers outside any transaction, and `finish` writes her message, or passes the question to
 * the class's teachers and gives the credits back. It is internal.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "begin",
      args: () => ({ messageId: Id("classroomMessages") }),
      returns: () => Schema.NullOr(NinaAsk),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "finish",
      args: () => ({
        answer: Schema.NullOr(Schema.String),
        messageId: Id("classroomMessages"),
      }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "reply",
      args: () => ({ messageId: Id("classroomMessages") }),
      returns: () => Schema.Null,
    })
  );
