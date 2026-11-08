import { QueryResult } from "@confect/react";
import island from "@repo/backend/confect/_generated/refs/island";
import { growthOf } from "@repo/backend/confect/island/level";
import { STARTER_LAYOUT } from "@repo/backend/confect/island/starter";
import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import { IslandFrame } from "@/components/island/frame";
import { IslandHeader } from "@/components/island/header";
import { OpenIsland } from "@/components/island/open";
import { LayoutContent, PageFrame } from "@/components/shared/content/frame";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/frame";
import { privateHead } from "@/lib/account/head";
import { islandScreenFn } from "@/lib/account/home.functions";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";
import { IslandContext } from "@/lib/island/context";

export const Route = createFileRoute("/$locale/_main/_app/_account/island")({
  loader: ({ params }) => islandScreenFn({ data: { locale: params.locale } }),
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : privateHead(loaderData.seo),
  component: IslandPage,
});

/** The island a learner owns before their first visit opens it: the starter set, nothing earned. */
const STARTER_ISLAND = {
  layout: STARTER_LAYOUT,
  lifetime: 0,
  stars: 0,
  version: 0,
};

/**
 * The signed-in learner's island, in the app shell (ADR 0042). The page reads
 * the loader's island until the live one answers, and draws the starter set for
 * a learner whose first visit is opening it now, which is what that visit makes.
 */
function IslandPage() {
  const { island: preloaded, name } = Route.useLoaderData();
  const live = usePreloadedQueryResult(island.queries.own, {}, preloaded);
  const shown =
    QueryResult.isSuccess(live) && live.value !== null
      ? live.value
      : STARTER_ISLAND;
  return (
    <IslandContext
      value={{
        layout: shown.layout,
        owner: Option.some({
          level: growthOf(shown.lifetime).level,
          stars: shown.stars,
          version: shown.version,
        }),
        size: growthOf(shown.lifetime).size,
      }}
    >
      <OpenIsland />
      <PageFrame width="page">
        <LayoutMaterial>
          <LayoutMaterialContent>
            <IslandHeader />
            <LayoutContent className="py-6">
              <IslandFrame
                lifetime={shown.lifetime}
                name={name}
                stars={shown.stars}
              />
            </LayoutContent>
          </LayoutMaterialContent>
        </LayoutMaterial>
      </PageFrame>
    </IslandContext>
  );
}
