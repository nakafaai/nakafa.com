import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { type Infer, v } from "convex/values";
import { Effect, Schema } from "effect";

/** Stable route identity accepted by the private try-out content seam. */
export const tryoutContentRequestValidator = v.object({
  countryKey: tryoutRouteKeyValidator,
  examKey: tryoutRouteKeyValidator,
  locale: localeValidator,
  sectionKey: tryoutRouteKeyValidator,
  setKey: tryoutRouteKeyValidator,
  trackKey: tryoutRouteKeyValidator,
});
/** Stable route identity accepted by the private try-out content seam. */
export type TryoutContentRequest = Infer<typeof tryoutContentRequestValidator>;

/** Internal read input after the HTTP action derives the authenticated user. */
export const tryoutContentReadArgsValidator = v.object({
  ...tryoutContentRequestValidator.fields,
  userId: v.id("users"),
});
/** Internal read input after the HTTP action derives the authenticated user. */
export type TryoutContentReadArgs = Infer<
  typeof tryoutContentReadArgsValidator
>;

const storedArtifactValidator = v.object({
  answerArtifactJson: v.optional(v.string()),
  placementId: v.id("tryoutAttemptPlacements"),
  questionArtifactJson: v.string(),
});

/** Bounded stored envelopes selected from one frozen attempt section. */
export const tryoutContentReadResultValidator = v.union(
  v.null(),
  v.object({ artifacts: v.array(storedArtifactValidator) })
);
/** Bounded stored envelopes selected from one frozen attempt section. */
export type TryoutContentReadResult = Infer<
  typeof tryoutContentReadResultValidator
>;

/** Stable failures raised while resolving frozen try-out content. */
export const tryoutContentErrorCode = {
  access: "TRYOUT_CONTENT_ACCESS_DENIED",
  integrity: "TRYOUT_CONTENT_INTEGRITY",
  limit: "TRYOUT_CONTENT_LIMIT_EXCEEDED",
  migration: "TRYOUT_CONTENT_MIGRATION_REQUIRED",
  missing: "TRYOUT_CONTENT_NOT_FOUND",
} as const;

const TryoutContentErrorCodeSchema = Schema.Literal(
  tryoutContentErrorCode.access,
  tryoutContentErrorCode.integrity,
  tryoutContentErrorCode.limit,
  tryoutContentErrorCode.migration,
  tryoutContentErrorCode.missing
);

/** Expected failure while resolving attempt-owned signed content artifacts. */
export class TryoutContentError
  extends Schema.TaggedError<TryoutContentError>()("TryoutContentError", {
    code: TryoutContentErrorCodeSchema,
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: typeof TryoutContentErrorCodeSchema.Type;
  declare readonly message: string;
}

/** Fails one try-out content program with an exact domain error. */
export function tryoutContentFail(
  code: TryoutContentError["code"],
  message: string
) {
  return Effect.fail(new TryoutContentError({ code, message }));
}
