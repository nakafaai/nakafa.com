import type { GrantView } from "@repo/backend/confect/access/schema";
import { Array as Arr } from "effect";

/**
 * Whether a viewer may open the exam pages and the sidebar item: a viewer who holds at
 * least one grant whose role is not Student. The server still refuses each exam that the
 * viewer may not read, so this only decides what the school shows.
 */
export const canOpenExams = (grants: readonly (typeof GrantView.Type)[]) =>
  Arr.some(grants, (grant) => grant.role.key !== "student");
