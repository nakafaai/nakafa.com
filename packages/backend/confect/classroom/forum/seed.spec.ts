import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { SeedRefused } from "@repo/backend/confect/acceptance/seed";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAddress } from "@repo/backend/confect/classroom/class";
import { TenantNotFound } from "@repo/backend/confect/tenancy/errors";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** The most messages one history seed writes, in one transaction. */
const SEED_HISTORY_LIMIT = 200;

/**
 * Seeds the history of a class's general channel for an acceptance run: `count`
 * messages from a classmate placed in the class, one minute apart and ending now, and the read mark
 * of every subject teacher of the class after the first `read` of them. It is
 * internal and refused outside the acceptance runtime, so no browser and no other
 * deployment can call it.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "history",
    args: () => ({
      classSlug: ClassAddress,
      count: Schema.Int.check(
        Schema.isBetween({ maximum: SEED_HISTORY_LIMIT, minimum: 1 })
      ),
      read: Schema.Int.check(
        Schema.isBetween({ maximum: SEED_HISTORY_LIMIT, minimum: 0 })
      ),
      slug: TenantSlug,
    }),
    returns: () =>
      Schema.Struct({
        channelId: Id("classroomChannels"),
        classId: Id("classes"),
        messages: Schema.Array(Id("classroomMessages")),
      }),
    error: () => Schema.Union([AccessDenied, SeedRefused, TenantNotFound]),
  })
);
