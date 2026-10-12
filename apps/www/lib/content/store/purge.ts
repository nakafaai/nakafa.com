import "server-only";

import { Effect, Schema } from "effect";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import { readContentStore } from "@/lib/content/store/read";

/** Proof, kept in the content store, that a release has run one purge. */
const PurgeProofSchema = Schema.Struct({ purged: Schema.Literal(true) });

/**
 * Runs one purge once for each release, however many times the release asks.
 *
 * The publisher invalidates one scope at a time, so a release reaches the
 * activation route once for every scope it changed, yet what a purge clears is
 * the same for all of them. The purge is the loader of a content store entry
 * named by `kind`: the first call of a release purges and stores the proof, and
 * the later calls find it. A purge that fails stores no proof, so the publisher's
 * retry purges again. The caller names the release because it has just proved
 * it against Convex, while the stored pointer may still name the previous
 * release and would file the proof under the wrong one.
 */
export const purgeOncePerRelease = Effect.fn("www.content.store.purge")(
  function* <E, R>(input: {
    readonly kind: string;
    readonly purge: Effect.Effect<void, E, R>;
    readonly releaseId: ActiveContentReleaseId;
  }) {
    yield* readContentStore({
      kind: input.kind,
      load: Effect.as(input.purge, PurgeProofSchema.make({ purged: true })),
      parts: [],
      release: input.releaseId,
      schema: PurgeProofSchema,
    });
  }
);
