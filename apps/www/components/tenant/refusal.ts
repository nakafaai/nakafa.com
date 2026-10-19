import { AccessDenied } from "@repo/backend/confect/access/errors";
import { NotMember } from "@repo/backend/confect/middleware/member.spec";
import { Schema } from "effect";

/**
 * Whether a failed read says the viewer is no longer a member of the school. Only that
 * answer sends the whole school to the refused page, because no page of the school can
 * show anything to a viewer who is not a member. A refusal of one item is not a lost
 * access, even when its reason is the viewer's role: the item shows its own sentence,
 * and a page whose own action the viewer lost is answered by its section's gate.
 */
export const isLostAccess = Schema.is(NotMember);

/** Whether a failed read refuses the viewer one item, which the page explains in its own place. */
export const isDenied = Schema.is(AccessDenied);
