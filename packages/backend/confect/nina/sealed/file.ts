import { getFile } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { MutationCtx } from "@repo/backend/confect/_generated/services";
import { SealedReadError } from "@repo/backend/confect/nina/sealed.spec";
import { Effect } from "effect";

/**
 * Reads one stored file of the component: the part a model reads, and the
 * storage entry of its bytes. The name it returns is the stored name. Sealing
 * the name is the writer's change, which comes in a later wave (ADR 0024).
 */
export const readFile = Effect.fn("nina.sealed.file")(function* (
  ctx: MutationCtx,
  fileId: string
) {
  return yield* Effect.tryPromise({
    try: () => getFile(ctx, components.nina, fileId),
    catch: () => new SealedReadError(),
  });
});
