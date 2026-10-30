import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  AccountUnavailable,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import { JoinOutcome } from "@repo/backend/confect/exams/sittings/contract";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * Joining a school's exam room by its code. The caller needs a session, not a membership: an
 * account that the school has not invited becomes a student of the room by the code its proctor
 * shows, and then enters the room through `exams.sittings.enter`.
 */
export default GroupSpec.make()
  .middleware(Session)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "join",
      args: () => ({
        sittingId: Schema.optionalKey(Id("examSittings")),
        slug: TenantSlug,
        token: Schema.String,
      }),
      returns: () => JoinOutcome,
      error: () => Schema.Union([SessionRequired, AccountUnavailable]),
    })
  );
