import {
  createCanonicalLearningContext,
  createContextKey,
  type LearningContextInput,
  type LearningContextStorage,
} from "@repo/backend/confect/contents/context";
import { toContentViewIoError } from "@repo/backend/confect/contents/views/spec";
import type { ContentViewTarget } from "@repo/backend/confect/contents/views/target";
import { programLayer } from "@repo/backend/content/program/confect";
import { readProgramContext } from "@repo/backend/content/program/context";
import { Effect } from "effect";

/** Resolves placement from the active immutable program snapshot. */
const resolvePublishedContext = Effect.fn(
  "contents.views.resolvePublishedContext"
)(function* (
  target: Extract<
    ContentViewTarget,
    {
      kind: "curriculum-lesson";
    }
  >,
  context: LearningContextInput,
  programKey: string,
  nodeKey: string
) {
  const resolved = yield* readProgramContext(target.locale, {
    contentKey: target.contentKey,
    materialKey: target.materialKey,
    nodeKey,
    parentPath: target.parentPath,
    programKey,
    publicPath: target.route,
  }).pipe(Effect.provide(programLayer), Effect.mapError(toContentViewIoError));
  if (!(resolved.managed && resolved.context)) {
    return createCanonicalLearningContext();
  }
  return {
    contextKey: createContextKey({
      mode: context.mode,
      nodeKey,
      programKey,
    }),
    contextMaterialKey: target.materialKey,
    contextMode: context.mode,
    contextNodeKey: nodeKey,
    contextParentPath: resolved.context.mapping.materialContextParentPath,
    contextProgramKey: programKey,
    contextPublicPath: resolved.context.mapping.materialContextPublicPath,
    contextSourcePath: target.sourcePath,
  } satisfies LearningContextStorage;
});

/**
 * Verifies optional learning context against the current signed snapshot.
 *
 * Invalid, stale, or non-material hints intentionally return canonical context
 * so callers do not invent curriculum placement for direct asset visits.
 */
export const resolveLearningContext = Effect.fn(
  "contents.views.context.resolveLearningContext"
)(function* (
  target: ContentViewTarget,
  context: LearningContextInput | undefined
) {
  if (!(context?.programKey && context.nodeKey)) {
    return createCanonicalLearningContext();
  }
  if (target.kind !== "curriculum-lesson") {
    return createCanonicalLearningContext();
  }
  return yield* resolvePublishedContext(
    target,
    context,
    context.programKey,
    context.nodeKey
  );
});
