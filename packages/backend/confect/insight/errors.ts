import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/** A draft Nina cannot write: the school keeps her off, or the teacher's pool cannot pay for it. */
export class DraftRefused extends Schema.TaggedError<DraftRefused>()(
  "DraftRefused",
  refusal("DRAFT_REFUSED", "Nina cannot draft this narrative now.")
) {}

/** A narrative that is not there: no student's narrative was written yet. */
export class NarrativeMissing extends Schema.TaggedError<NarrativeMissing>()(
  "NarrativeMissing",
  refusal("NARRATIVE_MISSING", "This student has no narrative yet.")
) {}
