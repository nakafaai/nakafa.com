import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import type { MaterialList } from "@repo/contents/curriculum/list";
import { toContextualMaterialHref } from "@repo/contents/route/material/context";
import { Array as Arr, Effect, MutableHashSet } from "effect";
import type { Locale } from "next-intl";
import { applyContentCache } from "@/lib/content/cache";
import type { PublishedCurriculumRoute } from "@/lib/content/program/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";

/** Builds one stable contextual lesson URL from source-owned identities. */
function toMaterialHref(
  locale: Locale,
  material: MaterialLessonProjection,
  group: PublishedCurriculumRoute
) {
  const context = {
    nodeKey: group.nodeKey,
    programKey: group.programKey,
  };
  return toContextualMaterialHref({
    href: `/${locale}/${material.publicPath}`,
    ref: context,
  });
}

/** Selects current material routes for one immutable curriculum mapping. */
const selectMaterialRoutes = Effect.fn("NakafaProgram.selectMaterialRoutes")(
  function* ({
    canonicalPath,
    locale,
    materialGroup,
    publicPath,
  }: {
    readonly canonicalPath: NonNullable<
      PublishedCurriculumRoute["canonicalPath"]
    >;
    readonly locale: Locale;
    readonly materialGroup: readonly MaterialLessonProjection[];
    readonly publicPath: PublishedCurriculumRoute["publicPath"];
  }) {
    const appLocale = AppLocaleSchema.make(locale);
    if (materialGroup.length === 0) {
      return [];
    }
    const exact = materialGroup.find(
      (material) => material.publicPath === canonicalPath
    );
    if (exact) {
      return [exact];
    }
    const matchingParent = materialGroup.filter(
      (material) => material.parentPath === canonicalPath
    );
    if (matchingParent.length > 0) {
      return materialGroup;
    }
    const currentParents = Arr.dedupe(
      materialGroup.map(({ parentPath }) => parentPath)
    );
    if (currentParents.length === 1) {
      return materialGroup;
    }
    return yield* new PublishedProjectionError({ appLocale, publicPath });
  }
);

/** Resolves one group's immutable contexts before projecting its ordered cards. */
const readGroupMaterialPaths = Effect.fn(
  "NakafaProgram.readGroupMaterialPaths"
)(function* (
  contexts: readonly PublishedCurriculumRoute[],
  materials: readonly MaterialLessonProjection[],
  locale: Locale,
  publicPath: PublishedCurriculumRoute["publicPath"]
) {
  const appLocale = AppLocaleSchema.make(locale);
  let hasMaterialContext = false;
  const selected = MutableHashSet.empty<string>();
  for (const context of contexts) {
    if (!context.materialKey) {
      continue;
    }
    hasMaterialContext = true;
    if (!context.canonicalPath) {
      return yield* new PublishedProjectionError({ appLocale, publicPath });
    }
    const owned = yield* selectMaterialRoutes({
      canonicalPath: context.canonicalPath,
      locale,
      materialGroup: materials.filter(
        (material) => material.materialKey === context.materialKey
      ),
      publicPath,
    });
    for (const material of owned) {
      MutableHashSet.add(selected, material.publicPath);
    }
  }
  return { hasMaterialContext, selected };
});

/** Builds the established material-card model from published projections. */
export const readPublishedMaterialCards = Effect.fn(
  "NakafaProgram.readMaterialCards"
)(function* ({
  contexts,
  groups,
  locale,
  materials,
  route,
}: {
  readonly contexts: readonly PublishedCurriculumRoute[];
  readonly groups: readonly PublishedCurriculumRoute[];
  readonly locale: Locale;
  readonly materials: readonly MaterialLessonProjection[];
  readonly route: PublishedCurriculumRoute;
}) {
  const appLocale = AppLocaleSchema.make(locale);
  if (!(route.level === "subject" || route.level === "course")) {
    return [] satisfies MaterialList;
  }
  const cards: MaterialList = [];
  for (const group of groups) {
    const { hasMaterialContext, selected } = yield* readGroupMaterialPaths(
      contexts.filter(
        (context) => context.materialContextPublicPath === group.publicPath
      ),
      materials,
      locale,
      route.publicPath
    );
    const items: MaterialList[number]["items"] = [];
    for (const material of materials) {
      if (!MutableHashSet.has(selected, material.publicPath)) {
        continue;
      }
      items.push({
        href: toMaterialHref(locale, material, group),
        title: material.metadata.title,
      });
    }
    const title = group.materialCardTitle ?? group.title;
    const description = group.materialCardDescription;
    const firstItem = items.at(0);
    if (!firstItem && hasMaterialContext) {
      continue;
    }
    if (!(description && firstItem)) {
      return yield* new PublishedProjectionError({
        appLocale,
        publicPath: route.publicPath,
      });
    }
    cards.push({ description, href: firstItem.href, items, title });
  }
  return cards;
});

/** Caches material cards while starting Effect only inside the cache boundary. */
export async function getPublishedMaterialCards(
  input: Parameters<typeof readPublishedMaterialCards>[0]
) {
  "use cache";

  const cards = await Effect.runPromise(
    readPublishedMaterialCards(input).pipe(Effect.withTracerTiming(false))
  );
  applyContentCache("program", "material");
  return cards;
}
