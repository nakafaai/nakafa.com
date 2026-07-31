import "server-only";

import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import type { MaterialList } from "@repo/contents/_types/curriculum/material";
import { toContextualMaterialHref } from "@repo/contents/_types/route/material/context";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
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
    materialKey,
    materials,
    publicPath,
  }: {
    readonly canonicalPath: NonNullable<
      PublishedCurriculumRoute["canonicalPath"]
    >;
    readonly locale: Locale;
    readonly materialKey: NonNullable<PublishedCurriculumRoute["materialKey"]>;
    readonly materials: readonly MaterialLessonProjection[];
    readonly publicPath: PublishedCurriculumRoute["publicPath"];
  }) {
    const materialGroup = materials.filter(
      (material) => material.materialKey === materialKey
    );
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
    const currentParents = new Set(
      materialGroup.map(({ parentPath }) => parentPath)
    );
    if (currentParents.size === 1) {
      return materialGroup;
    }
    return yield* new PublishedProjectionError({ locale, publicPath });
  }
);

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
  if (!(route.level === "subject" || route.level === "course")) {
    return [] satisfies MaterialList;
  }
  const cards: MaterialList = [];
  for (const group of groups) {
    let hasMaterialContext = false;
    const selected = new Set<string>();
    for (const context of contexts) {
      if (context.materialContextPublicPath !== group.publicPath) {
        continue;
      }
      if (!context.materialKey) {
        continue;
      }
      hasMaterialContext = true;
      if (!context.canonicalPath) {
        return yield* new PublishedProjectionError({
          locale,
          publicPath: route.publicPath,
        });
      }
      const owned = yield* selectMaterialRoutes({
        canonicalPath: context.canonicalPath,
        locale,
        materialKey: context.materialKey,
        materials,
        publicPath: route.publicPath,
      });
      for (const material of owned) {
        selected.add(material.publicPath);
      }
    }
    const items: MaterialList[number]["items"] = [];
    for (const material of materials) {
      if (!selected.has(material.publicPath)) {
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
        locale,
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

  const cards = await Effect.runPromise(readPublishedMaterialCards(input));
  applyContentRuntimeCache();
  return cards;
}
