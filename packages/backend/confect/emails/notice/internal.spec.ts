import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { SiteConfigError } from "@repo/backend/confect/site/spec";
import { NoticeEmailInputSchema } from "@repo/email/templates/notice/content";
import { Schema } from "effect";

/** The Persons one notice email goes to, at most one fan-out batch. */
const Recipients = Schema.Array(Id("tenantPeople")).check(
  Schema.isMaxLength(100)
);

/**
 * The email of a class announcement whose teacher chose email (ADR 0027): what it
 * says and to which addresses, the hand-off to the mail provider, and the send
 * that runs both around the render.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "readInput",
      args: () => ({ postId: Id("classroomPosts"), recipients: Recipients }),
      returns: () =>
        Schema.NullOr(
          Schema.Struct({
            addresses: Schema.Array(
              Schema.Struct({ email: Schema.String, personId: Id("tenantPeople") })
            ),
            input: NoticeEmailInputSchema,
          })
        ),
      error: () => Schema.Union([ReleaseError, SiteConfigError]),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "enqueue",
      args: () => ({
        addresses: Schema.Array(
          Schema.Struct({ email: Schema.String, personId: Id("tenantPeople") })
        ),
        html: Schema.String,
        postId: Id("classroomPosts"),
        subject: Schema.String,
        text: Schema.String,
      }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "send",
      args: () => ({ postId: Id("classroomPosts"), recipients: Recipients }),
      returns: () => Schema.Null,
    })
  );
