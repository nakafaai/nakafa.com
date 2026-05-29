import { Schema } from "effect";

export const tryoutExpirySweepIoFailedCode = "TRYOUT_EXPIRY_SWEEP_IO_FAILED";

export const tryoutExpirySweepBatchSize = 25;

/** Raised when Convex IO fails while scheduling overdue tryout expirations. */
export class TryoutExpirySweepIoError extends Schema.TaggedError<TryoutExpirySweepIoError>()(
  "TryoutExpirySweepIoError",
  {
    code: Schema.Literal(tryoutExpirySweepIoFailedCode),
    message: Schema.String,
  }
) {}
