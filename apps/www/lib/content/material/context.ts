import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { CurriculumRoute } from "@nakafa/aksara-contracts/program/curriculum";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { api } from "@repo/backend/convex/_generated/api";
import type { MaterialContextIdentity } from "@repo/contents/_types/route/material/reference";
import { slugify } from "@repo/design-system/lib/routing/slug";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { decodeCurriculumJson } from "@/lib/content/program/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import type { ContentReleasePin } from "@/lib/content/published/release";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

type PublishedMaterialIdentity = Pick<
  MaterialLessonProjection,
  "contentKey" | "materialKey" | "parentPath" | "publicPath"
>;

/** Verified curriculum return link for one material lesson. */
export interface PublishedMaterialContext {
  readonly context: MaterialContextIdentity;
  readonly group: CurriculumRoute;
  readonly href: string;
  readonly label: string;
  readonly mapping: CurriculumRoute;
  readonly parent: CurriculumRoute;
}

/** Reads one exact published curriculum context for a material identity. */
export const readPublishedMaterialContext = Effect.fn(
  "NakafaMaterial.readPublishedContext"
)(function* (
  locale: Locale,
  material: PublishedMaterialIdentity,
  context: MaterialContextIdentity,
  expectedActiveReleaseId?: ContentReleasePin
) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* readRuntimeQuery(api.contentRelease.program.context, {
    ...(expectedActiveReleaseId === undefined
      ? {}
      : { expectedActiveReleaseId }),
    contentKey: material.contentKey,
    appLocale,
    materialKey: material.materialKey,
    nodeKey: context.nodeKey,
    parentPath: material.parentPath,
    programKey: context.programKey,
    publicPath: material.publicPath,
  });
  if (!result.managed) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: material.publicPath,
    });
  }
  if (
    result.groupJson === null &&
    result.mappingJson === null &&
    result.parentJson === null &&
    result.resolvedCanonicalPath === null
  ) {
    return null;
  }
  if (
    result.groupJson === null ||
    result.mappingJson === null ||
    result.parentJson === null ||
    result.resolvedCanonicalPath === null
  ) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: material.publicPath,
    });
  }
  const [group, mapping, parent] = yield* Effect.all([
    decodeCurriculumJson(result.groupJson, locale, "materials"),
    decodeCurriculumJson(result.mappingJson, locale, material.publicPath),
    decodeCurriculumJson(result.parentJson, locale, "materials"),
  ]);
  if (
    group.appLocale !== appLocale ||
    group.nodeKey !== context.nodeKey ||
    group.programKey !== context.programKey ||
    group.parentPath !== parent.publicPath ||
    mapping.appLocale !== appLocale ||
    mapping.materialContextNodeKey !== group.nodeKey ||
    mapping.materialContextParentPath !== parent.publicPath ||
    mapping.materialContextPublicPath !== group.publicPath ||
    mapping.materialKey !== material.materialKey ||
    mapping.programKey !== context.programKey ||
    !(
      result.resolvedCanonicalPath === material.publicPath ||
      result.resolvedCanonicalPath === material.parentPath
    ) ||
    parent.appLocale !== appLocale ||
    parent.programKey !== context.programKey ||
    !(parent.level === "subject" || parent.level === "course")
  ) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: group.publicPath,
    });
  }
  const label = group.materialCardTitle ?? group.title;
  return {
    context,
    group,
    href: `/${locale}/${parent.publicPath}#${slugify(label)}`,
    label,
    mapping,
    parent,
  } satisfies PublishedMaterialContext;
});

/** Caches one validated material context under release invalidation. */
export async function getPublishedMaterialContext(
  locale: Locale,
  material: PublishedMaterialIdentity,
  context: MaterialContextIdentity,
  expectedActiveReleaseId?: ContentReleasePin
) {
  "use cache";

  const result = await Effect.runPromise(
    readPublishedMaterialContext(
      locale,
      material,
      context,
      expectedActiveReleaseId
    )
  );
  applyContentRuntimeCache();
  return result;
}
