import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/** A release asked before its sitting closes, when students would see partial results. */
export class SittingNotClosed extends Schema.TaggedError<SittingNotClosed>()(
  "SittingNotClosed",
  {
    ...refusal(
      "SITTING_NOT_CLOSED",
      "Close the sitting before you release its results."
    ),
  }
) {}

/** A grade for an answer that the sitting does not hold: an attempt of another sitting, one not submitted, or a question it did not score. */
export class ResultNotFound extends Schema.TaggedError<ResultNotFound>()(
  "ResultNotFound",
  {
    ...refusal(
      "RESULT_NOT_FOUND",
      "This answer is not one of the sitting's scored answers."
    ),
  }
) {}

/** A grade of more points than the question is worth. */
export class PointsAboveWeight extends Schema.TaggedError<PointsAboveWeight>()(
  "PointsAboveWeight",
  {
    ...refusal(
      "POINTS_ABOVE_WEIGHT",
      "Give at most the points the question is worth."
    ),
  }
) {}
