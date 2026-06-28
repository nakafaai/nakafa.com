import { createNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import type {
  NakafaAgentContentRef,
  NakafaAgentSection,
} from "@repo/contents/_lib/agent/schema/ref";
import type { Locale } from "@repo/contents/_types/content";
import { InvalidLearningGraphRouteError } from "@repo/contents/_types/graph/schema";
import { Option } from "effect";

/** Reads a trusted graph content reference for tests and static fixtures. */
export function readNakafaContentRefFixture(
  locale: Locale,
  route: string,
  section: NakafaAgentSection
): NakafaAgentContentRef {
  return Option.getOrThrowWith(
    createNakafaContentRef(locale, route, section),
    () =>
      new InvalidLearningGraphRouteError({
        message: `Expected Nakafa content ref fixture for ${route}.`,
        route,
      })
  );
}
