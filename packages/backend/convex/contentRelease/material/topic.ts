import { makeLearningGraphIdentity } from "@nakafa/aksara-contracts/graph/identity";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

/** Derives one material topic reference from an authenticated lesson projection. */
export const deriveMaterialTopicReference = Effect.fn(
  "contentRelease.deriveMaterialTopicReference"
)(function* (projection: MaterialLessonProjection) {
  const [kind, domain, topic, ...extra] = projection.materialKey.split(".");
  if (kind !== "lesson" || !domain || !topic || extra.length > 0) {
    return yield* materialTopicFailure(
      `Material ${projection.contentKey}/${projection.locale} has an invalid topic key.`
    );
  }

  const graph = yield* makeLearningGraphIdentity({
    concept: ["material", "lesson", domain, topic],
    learningObject: ["material-topic", domain, topic],
    lens: ["material", "lesson", domain],
    locale: projection.locale,
  }).pipe(
    Effect.catchTag("LearningGraphIdentityError", () =>
      materialTopicFailure(
        `Material ${projection.contentKey}/${projection.locale} has an invalid topic graph.`
      )
    )
  );

  return {
    graph,
    locale: projection.locale,
    publicPath: projection.parentPath,
    title: projection.topicTitle,
  };
});

function materialTopicFailure(message: string) {
  return releaseFail("CONTENT_RELEASE_INTEGRITY", message);
}
