import type { Locale } from "@repo/contents/_types/content";
import type {
  PracticeMaterialGroup,
  PracticeMaterialSource,
} from "@repo/contents/_types/material/schema";
import type { RouteInputs } from "@repo/contents/_types/route/input";
import {
  lookupDomainSlug,
  lookupNamespaceSegment,
  makePath,
} from "@repo/contents/_types/route/path";
import { toPublicPracticeGroupSegment } from "@repo/contents/_types/route/practice/path";
import { Effect } from "effect";

/** Builds the canonical practice group prefix beneath one rendered domain page. */
export function makePracticeGroupPath({
  domains,
  group,
  locale,
  material,
}: {
  domains: NonNullable<RouteInputs["domains"]>;
  group: PracticeMaterialGroup;
  locale: Locale;
  material: Pick<PracticeMaterialSource, "assessment" | "domain">;
}) {
  return Effect.gen(function* () {
    return yield* makePath([
      yield* lookupNamespaceSegment("exercises", locale),
      material.assessment,
      yield* lookupDomainSlug(domains, "practice", material.domain, locale),
      toPublicPracticeGroupSegment(group, locale),
    ]);
  });
}

/** Builds the rendered practice domain path that owns visible set-group cards. */
export function makePracticeDomainPath({
  domains,
  locale,
  material,
}: {
  domains: NonNullable<RouteInputs["domains"]>;
  locale: Locale;
  material: Pick<PracticeMaterialSource, "assessment" | "domain">;
}) {
  return Effect.gen(function* () {
    return yield* makePath([
      yield* lookupNamespaceSegment("exercises", locale),
      material.assessment,
      yield* lookupDomainSlug(domains, "practice", material.domain, locale),
    ]);
  });
}
