import { failureWire } from "@repo/backend/confect/failure";
import { Schema } from "effect";

export class SchoolReadError extends Schema.TaggedError<SchoolReadError>()(
  "SchoolReadError",
  {
    code: Schema.Literals(["SCHOOL_NOT_FOUND", "MEMBERSHIP_NOT_FOUND"]),
    message: Schema.String,
  }
) {}

export class SchoolCreateError extends Schema.TaggedError<SchoolCreateError>()(
  "SchoolCreateError",
  {
    code: Schema.Literal("SCHOOL_ALREADY_EXISTS"),
    message: Schema.String,
  }
) {}

export const SchoolReadFailure = failureWire(SchoolReadError);
export const SchoolCreateFailure = failureWire(SchoolCreateError);
