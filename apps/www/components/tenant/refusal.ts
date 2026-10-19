import { AccessDenied } from "@repo/backend/confect/access/errors";
import { NotMember } from "@repo/backend/confect/middleware/member.spec";
import { Schema } from "effect";

/**
 * Whether a failed read says the viewer has lost the school's access: the viewer
 * is no longer a member of the school, or the viewer no longer holds the role that
 * the page needs. The school pages answer it with the refused page, and no other
 * failure of a read does. A refusal of one item, such as an exam the viewer may not
 * open, is not a lost access, and a page shows it in its own place.
 */
export const isLostAccess = (error: unknown): boolean =>
  Schema.is(NotMember)(error) ||
  (Schema.is(AccessDenied)(error) && error.reason === "role");

/** Whether a failed read refuses the viewer one item, which the page explains in its own place. */
export const isDenied = Schema.is(AccessDenied);
