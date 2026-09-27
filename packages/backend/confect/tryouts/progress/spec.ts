import { Schema } from "effect";

/** A compact progress row would invalidate the signed-catalog read proof. */

export class TryoutProgressSizeError extends Schema.TaggedError<TryoutProgressSizeError>()(
  "TryoutProgressSizeError",
  {
    code: Schema.Literal("TRYOUT_PROGRESS_SIZE"),
    message: Schema.String,
  }
) {
  declare readonly code: "TRYOUT_PROGRESS_SIZE";
  declare readonly message: string;
}

/** Checks the stored-row ceiling reserved by complete catalog hydration. */

/** Expected failure while persisting compact try-out progress. */

export class TryoutProgressError extends Schema.TaggedError<TryoutProgressError>()(
  "TryoutProgressError",
  {
    code: Schema.Literals([
      "TRYOUT_ACTIVE_PROGRESS_HAS_SCORE",
      "TRYOUT_TERMINAL_PROGRESS_SCORE_REQUIRED",
      "TRYOUT_PROGRESS_WRITE_FAILED",
    ]),
    message: Schema.String,
  }
) {
  declare readonly message: string;
}

/** Stores the latest compact attempt state used by set discovery queries. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
