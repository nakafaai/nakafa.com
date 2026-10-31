import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/** A narrative that is not there: no student's narrative was written yet. */
export class NarrativeMissing extends Schema.TaggedError<NarrativeMissing>()(
  "NarrativeMissing",
  refusal("NARRATIVE_MISSING", "This student has no narrative yet.")
) {}
