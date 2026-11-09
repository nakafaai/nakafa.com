import type * as Ref from "@confect/core/Ref";
import { QueryResult } from "@confect/react";
import island from "@repo/backend/confect/_generated/refs/island";
import { growthOf } from "@repo/backend/confect/island/level";
import { NO_MATERIALS } from "@repo/backend/confect/island/material";
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

/**
 * The island a learner owns before their first visit opens it: the starter
 * set, nothing earned, harvested or watered, in the zone the server gives an
 * island before its owner's browser names theirs.
 */
const STARTER_ISLAND: Pick<
  NonNullable<Ref.Returns<typeof island.queries.own>>,
  | "badges"
  | "layout"
  | "learned"
  | "level"
  | "lifetime"
  | "materials"
  | "size"
  | "stars"
  | "timeZone"
  | "version"
  | "visibility"
  | "watered"
> = {
  badges: [],
  layout: STARTER_LAYOUT,
  level: 1,
  lifetime: 0,
  materials: NO_MATERIALS,
  size: growthOf(0).size,
  stars: 0,
  timeZone: "UTC",
  version: 0,
  visibility: "private",
};

/**
 * The signed-in learner's island, in the app shell (ADR 0042). The page reads
 * the loader's island until the live one answers, and draws the starter set for
 * a learner whose first visit is opening it now, which is what that visit makes.
 */
function IslandPage() {
  const { island: preloaded, name, username } = Route.useLoaderData();
  const live = usePreloadedQueryResult(island.queries.own, {}, preloaded);
  const shown =
    QueryResult.isSuccess(live) && live.value !== null
      ? live.value
      : STARTER_ISLAND;
  return (
    <IslandContext
      value={{
        badges: shown.badges.length,
        layout: shown.layout,
        level: shown.level,
        owner: Option.some({
          learned: Option.fromNullishOr(shown.learned),
          lifetime: shown.lifetime,
          materials: shown.materials,
          stars: shown.stars,
          username: Option.fromNullishOr(username),
          version: shown.version,
          visibility: shown.visibility,
          watered: Option.fromNullishOr(shown.watered),
        }),
        size: shown.size,
        timeZone: shown.timeZone,
      }}
    >
      <OpenIsland />
      <PageFrame width="page">
        <LayoutMaterial>
          <LayoutMaterialContent>
            <IslandHeader />
            <LayoutContent className="py-6">
              <IslandFrame name={name} />
            </LayoutContent>
          </LayoutMaterialContent>
        </LayoutMaterial>
      </PageFrame>
    </IslandContext>
  );
}
