import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/** A school with no impact assessment on record: Insight stays off (ADR 0035). */
export class DpiaRequired extends Schema.TaggedError<DpiaRequired>()(
  "DpiaRequired",
  refusal(
    "DPIA_REQUIRED",
    "Insight stays off until the school records its impact assessment."
  )
) {}

/** A narrative that is not there: no student's narrative was written yet. */
export class NarrativeMissing extends Schema.TaggedError<NarrativeMissing>()(
  "NarrativeMissing",
  refusal("NARRATIVE_MISSING", "This student has no narrative yet.")
) {}
