import { makeLearningGraphIdentity } from "@nakafa/aksara-contracts/graph/identity";
import { createNakafaContentRefFromGraphProjection } from "@repo/contents/_lib/agent/refs";
import type {
  NakafaAgentContentRef,
  NakafaAgentReadableContentRef,
  NakafaAgentSection,
} from "@repo/contents/_lib/agent/schema/ref";
import { NakafaAgentReadableContentRefSchema } from "@repo/contents/_lib/agent/schema/ref";
import type { Locale } from "@repo/contents/_types/content";
import { Effect, Option, Schema } from "effect";

type ReadableAgentSection = Exclude<NakafaAgentSection, "tryout">;

/** Reads a trusted graph content reference for tests and static fixtures. */
export function readNakafaContentRefFixture(
  locale: Locale,
  route: string,
  section: ReadableAgentSection
): NakafaAgentReadableContentRef;
export function readNakafaContentRefFixture(
  locale: Locale,
  route: string,
  section: NakafaAgentSection
): NakafaAgentContentRef;
export function readNakafaContentRefFixture(
  locale: Locale,
  route: string,
  section: NakafaAgentSection
): NakafaAgentContentRef {
  const routeSegments = route.split("/");
  const identity = Effect.runSync(
    makeLearningGraphIdentity({
      concept: ["fixture", section, ...routeSegments],
      learningObject: ["fixture", section, ...routeSegments],
      lens: ["fixture", section],
      locale,
    })
  );

  const decoded = createNakafaContentRefFromGraphProjection({
    ...identity,
    content_id: identity.assetId,
    locale,
    route,
    section,
  });

  if (Option.isNone(decoded)) {
    throw new Error(`Invalid Nakafa content reference fixture: ${route}`);
  }

  const ref = decoded.value;

  if (section === "tryout") {
    return ref;
  }

  return Schema.decodeUnknownSync(NakafaAgentReadableContentRefSchema)(ref);
}
