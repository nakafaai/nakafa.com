import type { ClassesDoc } from "@repo/backend/confect/_generated/docs";
import { subjectTeacherOf } from "@repo/backend/confect/classroom/authority";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Effect } from "effect";

/**
 * Whether a member who writes in a class's forum may open a discussion there: a
 * subject teacher always may, and a member of the class only while the school
 * lets students open discussions (`studentThreads`, ADR 0025).
 */
export const opensDiscussions = (
  row: ClassesDoc,
  principal: Member["Service"]
) =>
  principal.tenant.policies.studentThreads
    ? Effect.succeed(true)
    : subjectTeacherOf(row, principal);
