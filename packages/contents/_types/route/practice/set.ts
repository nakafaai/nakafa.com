import type { Locale } from "@repo/contents/_types/content";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import type { RouteInputs } from "@repo/contents/_types/route/input";
import {
  readDomainSlug,
  readNamespaceSegment,
} from "@repo/contents/_types/route/path";
import { isPracticeMaterialSource } from "@repo/contents/_types/route/practice/material";
import {
  getPracticeSourceGroupSlug,
  readPublicPracticePathParts,
  toPublicPracticeGroupSegment,
} from "@repo/contents/_types/route/practice/path";

/** Resolves projected public practice set routes to source asset set paths. */
export function readPublicPracticeSetRouteByPath({
  domains = MATERIAL_ROUTE_DOMAINS,
  locale,
  materials = MATERIAL_SOURCES,
  publicPath,
}: {
  domains?: NonNullable<RouteInputs["domains"]>;
  locale: Locale;
  materials?: NonNullable<RouteInputs["materials"]>;
  publicPath: string;
}) {
  const match = readPublicPracticeSetMatch({
    domains,
    locale,
    materials,
    publicPath,
  });

  if (!(match && match.parts.question === undefined)) {
    return;
  }

  return {
    kind: "set" as const,
    sourcePath: [
      match.material.assetRoot,
      getPracticeSourceGroupSlug(match.group),
      match.set.slug,
    ].join("/"),
  };
}

/** Reads the source-backed practice set match shared by set and question projection. */
export function readPublicPracticeSetMatch({
  domains,
  locale,
  materials,
  publicPath,
}: {
  domains: NonNullable<RouteInputs["domains"]>;
  locale: Locale;
  materials: NonNullable<RouteInputs["materials"]>;
  publicPath: string;
}) {
  const parts = readPublicPracticePathParts(publicPath);
  const namespace = readNamespaceSegment("exercises", locale);

  if (!(namespace && parts && parts.namespace === namespace)) {
    return;
  }

  for (const material of materials) {
    if (!isPracticeMaterialSource(material)) {
      continue;
    }

    const domainSlug = readDomainSlug(
      domains,
      "practice",
      material.domain,
      locale
    );

    if (
      !domainSlug ||
      parts.assessment !== material.assessment ||
      parts.domain !== domainSlug
    ) {
      continue;
    }

    for (const group of material.groups) {
      if (parts.group !== toPublicPracticeGroupSegment(group, locale)) {
        continue;
      }

      for (const set of group.sets) {
        if (parts.set === set.routeSlugs[locale]) {
          return { group, material, parts, set };
        }
      }
    }
  }

  return;
}
