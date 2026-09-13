import {
  internalMutation,
  internalQuery,
} from "@repo/backend/convex/_generated/server";
import { commitAdoption } from "@repo/backend/convex/contentRelease/adoption/commit";
import {
  adoptionIdentityValidator,
  adoptionReceiptValidator,
  adoptionStateValidator,
  commitValidator,
} from "@repo/backend/convex/contentRelease/adoption/spec";
import { readAdoptionState } from "@repo/backend/convex/contentRelease/adoption/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { v } from "convex/values";
import { Effect } from "effect";

/** Private authenticated-action input. Never expose learner rows through publication HTTP. */
export const read = internalQuery({
  args: adoptionIdentityValidator.fields,
  returns: adoptionStateValidator,
  handler: (ctx, args) => runConvexProgram(readAdoptionState(ctx, args)),
});

export const artifacts = internalQuery({
  args: { priorHash: v.string(), nextHash: v.string() },
  returns: v.object({
    prior: schema.doc("contentArtifacts"),
    next: schema.doc("contentArtifacts"),
  }),
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const prior = yield* Effect.promise(() =>
          ctx.db
            .query("contentArtifacts")
            .withIndex("by_artifactHash", (q) =>
              q.eq("artifactHash", args.priorHash)
            )
            .unique()
        );
        const next = yield* Effect.promise(() =>
          ctx.db
            .query("contentArtifacts")
            .withIndex("by_artifactHash", (q) =>
              q.eq("artifactHash", args.nextHash)
            )
            .unique()
        );
        if (!(prior && next)) {
          return yield* releaseFail(
            "CONTENT_RELEASE_MISSING",
            "Historical adoption lost a signed artifact."
          );
        }
        return { prior, next };
      })
    ),
});

/** Accepts only evidence produced by the internal Node authenticator. */
export const commit = internalMutation({
  args: commitValidator.fields,
  returns: adoptionReceiptValidator,
  handler: (ctx, args) => runConvexProgram(commitAdoption(ctx, args)),
});
