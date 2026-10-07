import type { Ref } from "@confect/core";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import type refs from "@repo/backend/confect/_generated/refs";
import type { MaterialContextIdentity } from "@repo/contents/route/material/reference";
import { slugify } from "@repo/utilities/slug";

import { Effect } from "effect";
import type { Locale } from "next-intl";
import { decodeCurriculumJson } from "@/lib/content/program/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";

export type PublishedMaterialIdentity = Pick<
  MaterialLessonProjection,
  "contentKey" | "materialKey" | "parentPath" | "publicPath"
>;

/** Verified curriculum return link for one material lesson. */
export type PublishedMaterialContext = Readonly<
  NonNullable<Effect.Success<ReturnType<typeof decodePublishedMaterialContext>>>
>;

/** Verifies the public query result before it can affect learner navigation. */
export const decodePublishedMaterialContext = Effect.fn(
  "NakafaMaterial.decodePublishedContext"
)(function* (
  locale: Locale,
  material: PublishedMaterialIdentity,
  context: MaterialContextIdentity,
  result: Ref.Returns<typeof refs.public.contentRelease.program.context>
) {
  const appLocale = AppLocaleSchema.make(locale);
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
    resolvedCanonicalPath: result.resolvedCanonicalPath,
  };
});
