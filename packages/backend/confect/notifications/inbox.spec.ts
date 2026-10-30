import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  AccountUnavailable,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  NotificationCursorInvalid,
  NotificationNotFound,
  NotificationScopeTooLarge,
} from "@repo/backend/confect/notifications/errors";
import { NotificationView } from "@repo/backend/confect/notifications/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** The school whose rows a call reads or marks; without it, every school the account holds. */
const scope = () => ({ slug: Schema.optionalKey(TenantSlug) });

/**
 * The inbox of the signed-in account: the rows of every school whose Person the
 * account holds. The account reads its rows, marks one read, or marks them all.
 * A school's own inbox page names its slug, so it reads and marks that school's
 * rows alone.
 */
export default GroupSpec.make()
  .middleware(Session)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: scope,
      item: () => NotificationView,
      error: () =>
        Schema.Union([
          SessionRequired,
          AccountUnavailable,
          NotificationCursorInvalid,
          NotificationScopeTooLarge,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "read",
      args: () => ({ notificationId: Id("notifications") }),
      returns: () => NotificationView,
      error: () =>
        Schema.Union([
          SessionRequired,
          AccountUnavailable,
          NotificationNotFound,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "readAll",
      args: scope,
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          SessionRequired,
          AccountUnavailable,
          NotificationScopeTooLarge,
        ]),
    })
  );
