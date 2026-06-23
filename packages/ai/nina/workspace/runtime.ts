import type { LearningCapabilityResult } from "@repo/ai/nina/capability/spec";
import { formatEvidenceWorkspaceProjection } from "@repo/ai/nina/workspace/projection";
import {
  appendCapabilityContribution,
  CapabilityContribution,
  createEvidenceWorkspace,
  type EvidenceWorkspace,
  type EvidenceWorkspaceDecodeError,
  type EvidenceWorkspaceLimitExceeded,
  WorkspaceEvidenceEnvelope,
} from "@repo/ai/nina/workspace/schema";
import { Clock, Context, Effect, Ref } from "effect";

/**
 * Turn-local evidence workspace seam used by Nina capability tools.
 * The state is request-scoped and append-only; durable persistence stays in
 * trace/artifact Modules instead of this in-memory runtime.
 */
export class NinaWorkspaceRuntime extends Context.Tag("NinaWorkspaceRuntime")<
  NinaWorkspaceRuntime,
  {
    readonly appendResult: (
      result: LearningCapabilityResult
    ) => Effect.Effect<
      CapabilityContribution,
      EvidenceWorkspaceDecodeError | EvidenceWorkspaceLimitExceeded
    >;
    readonly readProjection: () => Effect.Effect<string | undefined>;
    readonly readWorkspace: () => Effect.Effect<EvidenceWorkspace>;
  }
>() {}

/**
 * Creates the per-turn workspace state used behind one NinaHarness stream.
 */
export const createNinaWorkspaceRuntime = Effect.fn(
  "nina.workspace.createRuntime"
)(function* (input: { readonly turnId: string }) {
  const createdAt = yield* Clock.currentTimeMillis;
  const workspace = yield* createEvidenceWorkspace({
    createdAt,
    turnId: input.turnId,
  });
  const state = yield* Ref.make(workspace);
  const appendMutex = yield* Effect.makeSemaphore(1);

  return {
    appendResult: (result: LearningCapabilityResult) =>
      appendMutex.withPermits(1)(
        Effect.gen(function* () {
          const current = yield* Ref.get(state);
          const contribution = createContributionFromResult(result);
          const next = yield* appendCapabilityContribution(
            current,
            contribution
          );

          yield* Ref.set(state, next);
          return contribution;
        })
      ),
    readProjection: () =>
      Ref.get(state).pipe(Effect.map(formatEvidenceWorkspaceProjection)),
    readWorkspace: () => Ref.get(state),
  };
});

/**
 * Converts a capability result into the workspace contribution contract.
 */
function createContributionFromResult(result: LearningCapabilityResult) {
  return CapabilityContribution.make({
    capability: result.evidence.capability,
    evidence: WorkspaceEvidenceEnvelope.make({
      capability: result.evidence.capability,
      ...(result.evidence.limitations
        ? { limitations: [...result.evidence.limitations] }
        : {}),
      ...(result.evidence.refs ? { refs: [...result.evidence.refs] } : {}),
      status: result.evidence.status,
      summary: result.evidence.summary,
    }),
    modelSummary: readModelSummary(result),
  });
}

/**
 * Guarantees every contribution has nonblank text for continuation prompts.
 */
function readModelSummary(result: LearningCapabilityResult) {
  const summary = result.evidence.summary.trim();
  if (summary.length > 0) {
    return summary;
  }

  const text = result.text.trim();
  if (text.length > 0) {
    return text;
  }

  return `${result.evidence.capability} returned ${result.evidence.status} evidence.`;
}
