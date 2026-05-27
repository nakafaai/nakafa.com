import { Effect, Schema } from "effect";

export { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/confect/modules/content/constants";

export class ContentSyncError extends Schema.TaggedError<ContentSyncError>()(
  "ContentSyncError",
  { message: Schema.String }
) {}

/** Fails when a content sync batch exceeds its documented safety limit. */
export function assertContentSyncBatchSize(args: {
  readonly functionName: string;
  readonly limit: number;
  readonly received: number;
  readonly unit: string;
}) {
  if (args.received <= args.limit) {
    return Effect.succeed(null);
  }

  return Effect.fail(
    new ContentSyncError({
      message: `${args.functionName} received ${args.received} ${args.unit}, which exceeds the safe limit of ${args.limit}.`,
    })
  );
}

/** Converts display text into the same sync slug format used by content scripts. */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
