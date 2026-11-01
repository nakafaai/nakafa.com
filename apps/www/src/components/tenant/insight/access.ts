import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import { Array as Arr } from "effect";
import type { SchoolViewer } from "@/lib/tenant/frame";

/** The grants a viewer holds in the school, which decide what Insight is for them. */
type Holder = Pick<SchoolViewer, "grants">;

/** The roles that read the Insight of every class of their scope without teaching it. */
const LEADERS: readonly BuiltinRole[] = [
  "owner",
  "admin",
  "principal",
  "deputy",
  "counselor",
];

/** Whether a viewer reads the classes of the school, on top of any they teach. */
export const readsEveryClass = (viewer: Holder) =>
  Arr.some(viewer.grants, (grant) => Arr.contains(LEADERS, grant.role.key));

/**
 * Whether Insight has a page for the viewer: a leader's classes, a teacher's classes, or a student's
 * own standing. Everyone else, a Proctor or a parent, has nothing to read there.
 */
export const canOpenInsight = (viewer: Holder) =>
  readsEveryClass(viewer) ||
  Arr.some(
    viewer.grants,
    (grant) => grant.role.key === "teacher" || grant.role.key === "student"
  );
