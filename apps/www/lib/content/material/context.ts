import "server-only";

import type { CurriculumRoute } from "@nakafa/aksara-contracts/program/curriculum";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { api } from "@repo/backend/convex/_generated/api";
import type { MaterialContextIdentity } from "@repo/contents/_types/route/material/reference";
import type { PublicMaterialLessonRoute } from "@repo/contents/_types/route/schema";
import { slugify } from "@repo/design-system/lib/routing/slug";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import type { MaterialReleasePin } from "@/lib/content/material/release";
import { decodeCurriculumJson } from "@/lib/content/program/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

type PublishedMaterialIdentity =
  | Pick<
      MaterialLessonProjection,
      "contentKey" | "materialKey" | "parentPath" | "publicPath"
    >
  | Pick<
      PublicMaterialLessonRoute,
      "materialKey" | "parentPath" | "publicPath" | "sourcePath"
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
  expectedActiveReleaseId?: MaterialReleasePin
) {
  const contentKey =
    "contentKey" in material ? material.contentKey : material.sourcePath;
  const result = yield* readRuntimeQuery("contentRelease.program.context", () =>
    fetchRuntimeQuery(api.contentRelease.program.context, {
      ...(expectedActiveReleaseId === undefined
        ? {}
        : { expectedActiveReleaseId }),
      contentKey,
      locale,
      materialKey: material.materialKey,
      nodeKey: context.nodeKey,
      parentPath: material.parentPath,
      programKey: context.programKey,
      publicPath: material.publicPath,
    })
  );
  if (!result.managed) {
    return { managed: false, value: null };
  }
  if (
    result.groupJson === null &&
    result.mappingJson === null &&
    result.parentJson === null &&
    result.resolvedCanonicalPath === null
  ) {
    return { managed: true, value: null };
  }
  if (
    result.groupJson === null ||
    result.mappingJson === null ||
    result.parentJson === null ||
    result.resolvedCanonicalPath === null
  ) {
    return yield* new PublishedProjectionError({
      locale,
      publicPath: material.publicPath,
    });
  }
  const [group, mapping, parent] = yield* Effect.all([
    decodeCurriculumJson(result.groupJson, locale, "materials"),
    decodeCurriculumJson(result.mappingJson, locale, material.publicPath),
    decodeCurriculumJson(result.parentJson, locale, "materials"),
  ]);
  if (
    group.locale !== locale ||
    group.nodeKey !== context.nodeKey ||
    group.programKey !== context.programKey ||
    group.parentPath !== parent.publicPath ||
    mapping.locale !== locale ||
    mapping.materialContextNodeKey !== group.nodeKey ||
    mapping.materialContextParentPath !== parent.publicPath ||
    mapping.materialContextPublicPath !== group.publicPath ||
    mapping.materialKey !== material.materialKey ||
    mapping.programKey !== context.programKey ||
    !(
      result.resolvedCanonicalPath === material.publicPath ||
      result.resolvedCanonicalPath === material.parentPath
    ) ||
    parent.locale !== locale ||
    parent.programKey !== context.programKey ||
    !(parent.level === "subject" || parent.level === "course")
  ) {
    return yield* new PublishedProjectionError({
      locale,
      publicPath: group.publicPath,
    });
  }
  const label = group.materialCardTitle ?? group.title;
  return {
    managed: true,
    value: {
      context,
      group,
      href: `/${locale}/${parent.publicPath}#${slugify(label)}`,
      label,
      mapping,
      parent,
    } satisfies PublishedMaterialContext,
  };
});

/** Caches one validated material context under release invalidation. */
export async function getPublishedMaterialContext(
  locale: Locale,
  material: PublishedMaterialIdentity,
  context: MaterialContextIdentity,
  expectedActiveReleaseId?: MaterialReleasePin
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
