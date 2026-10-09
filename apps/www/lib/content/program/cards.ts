import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import type { MaterialList } from "@repo/contents/curriculum/list";
import { toContextualMaterialHref } from "@repo/contents/route/material/context";
import {
  Array as Arr,
  Effect,
  MutableHashSet,
  MutableList,
  Option,
  Record as Rec,
} from "effect";
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
    const exact = Arr.findFirst(
      materialGroup,
      (material) => material.publicPath === canonicalPath
    );
    if (Option.isSome(exact)) {
      return [exact.value];
    }
    const matchingParent = Arr.filter(
      materialGroup,
      (material) => material.parentPath === canonicalPath
    );
    if (matchingParent.length > 0) {
      return materialGroup;
    }
    const currentParents = Arr.dedupe(
      Arr.map(materialGroup, ({ parentPath }) => parentPath)
    );
    if (currentParents.length === 1) {
      return materialGroup;
    }
    return yield* PublishedProjectionError.make({ appLocale, publicPath });
  }
);

/** Resolves one group's immutable contexts before projecting its ordered cards. */
const readGroupMaterialPaths = Effect.fn(
  "NakafaProgram.readGroupMaterialPaths"
)(function* (
  contexts: readonly PublishedCurriculumRoute[],
  materialsByKey: Rec.ReadonlyRecord<
    string,
    readonly MaterialLessonProjection[]
  >,
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
      return yield* PublishedProjectionError.make({ appLocale, publicPath });
    }
    const owned = yield* selectMaterialRoutes({
      canonicalPath: context.canonicalPath,
      locale,
      materialGroup: Option.getOrElse(
        Rec.get(materialsByKey, context.materialKey),
        () => []
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
  const materialsByKey = Arr.groupBy(
    materials,
    (material): string => material.materialKey
  );
  const cards = MutableList.make<MaterialList[number]>();
  for (const group of groups) {
    const { hasMaterialContext, selected } = yield* readGroupMaterialPaths(
      Arr.filter(
        contexts,
        (context) => context.materialContextPublicPath === group.publicPath
      ),
      materialsByKey,
      locale,
      route.publicPath
    );
    const items: MaterialList[number]["items"] = Arr.map(
      Arr.filter(materials, (material) =>
        MutableHashSet.has(selected, material.publicPath)
      ),
      (material) => ({
        href: toMaterialHref(locale, material, group),
        title: material.metadata.title,
      })
    );
    const title = group.materialCardTitle ?? group.title;
    const description = group.materialCardDescription;
    const firstItem = Arr.head(items);
    if (Option.isNone(firstItem) && hasMaterialContext) {
      continue;
    }
    if (!(description && Option.isSome(firstItem))) {
      return yield* PublishedProjectionError.make({
        appLocale,
        publicPath: route.publicPath,
      });
    }
    MutableList.append(cards, {
      description,
      href: firstItem.value.href,
      items,
      title,
    });
  }
  return MutableList.toArray(cards);
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
