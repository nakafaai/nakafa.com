import type { ClassesDoc } from "@repo/backend/confect/_generated/docs";
import { classAuthority } from "@repo/backend/confect/classroom/authority";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Effect } from "effect";

/**
 * Whether the caller manages a class's forum: a subject teacher of the class, the school's Admin, or
 * any Owner, as `forum.manage` rules it. A locked class refuses the write, so nobody manages its forum.
 */
export const managesForum = (row: ClassesDoc) =>
  classAuthority.check("forum.manage", row).pipe(
    Effect.as(true),
    Effect.catchTag("AccessDenied", () => Effect.succeed(false))
  );

/**
 * Whether a member who writes in a class's forum may open a discussion there: whoever manages the
 * forum always may, and a member of the class only while the school lets students open discussions
 * (`studentThreads`, ADR 0025).
 */
export const opensDiscussions = (
  row: ClassesDoc,
  principal: Member["Service"]
) =>
  principal.tenant.policies.studentThreads
    ? Effect.succeed(true)
    : managesForum(row);
