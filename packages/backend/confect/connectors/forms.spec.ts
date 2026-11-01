import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import {
  ConnectorOff,
  GoogleFailed,
} from "@repo/backend/confect/connectors/errors";
import { PlacedQuestion } from "@repo/backend/confect/exams/import";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

/**
 * The Forms connector (ADR 0015): the questions of a form the signed-in teacher picked, read through
 * their Drive connection, because `drive.file` covers a picked form. A question without an answer
 * key stays keyless for the teacher to complete. An account without Drive gets none.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicAction({
    name: "questions",
    args: () => ({ formId: Schema.String }),
    returns: () => Schema.NullOr(Schema.Array(PlacedQuestion)),
    error: () => Schema.Union([AuthFailure, ConnectorOff, GoogleFailed]),
  }).middleware(Session)
);
