"use node";

import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  type ActionCtx,
  internalAction,
} from "@repo/backend/convex/_generated/server";
import {
  type AdoptionCommit,
  type AdoptionRequest,
  type AdoptionState,
  adoptionReceiptValidator,
  adoptionRequestValidator,
} from "@repo/backend/convex/contentRelease/adoption/spec";
import { hashAdoptionState } from "@repo/backend/convex/contentRelease/adoption/state";
import {
  verifyAdoptionArtifact,
  verifyAdoptionState,
} from "@repo/backend/convex/contentRelease/adoption/verify";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

const readReference = makeFunctionReference<
  "query",
  Omit<AdoptionRequest, "expectedHistoryHash">,
  AdoptionState
>("contentRelease/adoption/internal:read");
const artifactsReference = makeFunctionReference<
  "query",
  { priorHash: string; nextHash: string },
  { prior: Doc<"contentArtifacts">; next: Doc<"contentArtifacts"> }
>("contentRelease/adoption/internal:artifacts");
const commitReference = makeFunctionReference<
  "mutation",
  AdoptionCommit,
  Infer<typeof adoptionReceiptValidator>
>("contentRelease/adoption/internal:commit");

/** Temporary per-snapshot authenticator. No activation, authoring or signing authority. */
export const adoptHistory = Effect.fn("contentRelease.adoption.adoptHistory")(
  function* (ctx: ActionCtx, request: AdoptionRequest) {
    const { expectedHistoryHash, ...identity } = request;
    const state = yield* callInternal(() =>
      ctx.runQuery(readReference, identity)
    );
    if (state.historyHash !== expectedHistoryHash) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        "Historical inventory changed since its reviewed private export."
      );
    }
    const renderers = yield* verifyAdoptionState(state);
    const evidence = new Map<string, AdoptionCommit["artifacts"][number]>();
    const pairs = new Map<string, { priorHash: string; nextHash: string }>();
    for (const { prior, next } of state.placements) {
      for (const [priorHash, nextHash] of [
        [prior.questionArtifactHash, next.questionArtifactHash],
        [prior.answerArtifactHash, next.answerArtifactHash],
      ] as const) {
        pairs.set(`${priorHash}\0${nextHash}`, { priorHash, nextHash });
      }
    }
    for (const pair of pairs.values()) {
      const artifacts = yield* callInternal(() =>
        ctx.runQuery(artifactsReference, pair)
      );
      const verified = yield* verifyAdoptionArtifact({
        ...artifacts,
        renderers,
      });
      for (const item of verified) {
        evidence.set(item.artifactHash, item);
      }
    }
    const stateHash = yield* hashAdoptionState(state);
    return yield* callInternal(() =>
      ctx.runMutation(commitReference, {
        ...request,
        stateHash,
        artifacts: [...evidence.values()],
      })
    );
  }
);

export const history = internalAction({
  args: adoptionRequestValidator.fields,
  returns: adoptionReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      adoptHistory(ctx, args).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        )
      )
    ),
});
