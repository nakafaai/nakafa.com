import { makeLearningGraphIdentity } from "@nakafa/aksara-contracts/graph/identity";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { Effect } from "effect";

/** Derives one material topic reference from an authenticated lesson projection. */
export const deriveMaterialTopicReference = Effect.fn(
  "contentRelease.deriveMaterialTopicReference"
)(function* (projection: MaterialLessonProjection) {
  const [, domain, topic] = projection.materialKey.split(".");
  const graph = yield* makeLearningGraphIdentity({
    concept: ["material", "lesson", domain, topic],
    learningObject: ["material-topic", domain, topic],
    lens: ["material", "lesson", domain],
    appLocale: projection.appLocale,
  }).pipe(Effect.orDie);
  return {
    graph,
    appLocale: projection.appLocale,
    publicPath: projection.parentPath,
    title: projection.topicTitle,
  };
});
