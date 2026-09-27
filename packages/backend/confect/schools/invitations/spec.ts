import { failureWire } from "@repo/backend/confect/failure";
import { Schema } from "effect";
export class InvitationError extends Schema.TaggedError<InvitationError>()(
  "InvitationError",
  {
    code: Schema.Literals([
      "INVALID_CODE",
      "CODE_DISABLED",
      "CODE_EXPIRED",
      "CODE_LIMIT_REACHED",
      "ALREADY_MEMBER",
    ]),
    message: Schema.String,
  }
) {}
export const InvitationFailure = failureWire(InvitationError);
