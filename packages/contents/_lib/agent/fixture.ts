import { createNakafaContentRefFromGraphProjection } from "@repo/contents/_lib/agent/refs";
import type {
  NakafaAgentContentRef,
  NakafaAgentSection,
} from "@repo/contents/_lib/agent/schema/ref";
import type { Locale } from "@repo/contents/_types/content";
import { getSourceRouteProjectionForRoute } from "@repo/contents/_types/graph/projection";
import { InvalidLearningGraphRouteError } from "@repo/contents/_types/graph/schema";
import { createLearningGraphIdentityFromProjection } from "@repo/contents/_types/learning-graph";
import { Option } from "effect";

/** Reads a trusted graph content reference for tests and static fixtures. */
export function readNakafaContentRefFixture(
  locale: Locale,
  route: string,
  section: NakafaAgentSection
): NakafaAgentContentRef {
  const projection = getSourceRouteProjectionForRoute(route, locale);

  if (!projection || projection.sourceRoot !== section) {
    throw createInvalidFixtureError(route);
  }

  const identity = createLearningGraphIdentityFromProjection({
    locale,
    projection,
  });

  return Option.getOrThrow(
    createNakafaContentRefFromGraphProjection({
      ...identity,
      content_id: identity.assetId,
      locale,
      route,
      section,
    })
  );
}

function createInvalidFixtureError(route: string) {
  return new InvalidLearningGraphRouteError({
    message: `Expected Nakafa content ref fixture for ${route}.`,
    route,
  });
}
