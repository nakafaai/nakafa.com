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
import { PageStack } from "@/components/shared/page/body";
import { Page } from "@/components/shared/page/frame";
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
  | "layout"
  | "learned"
  | "lifetime"
  | "materials"
  | "stars"
  | "timeZone"
  | "version"
  | "watered"
> = {
  layout: STARTER_LAYOUT,
  lifetime: 0,
  materials: NO_MATERIALS,
  stars: 0,
  timeZone: "UTC",
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
          learned: Option.fromNullishOr(shown.learned),
          level: growthOf(shown.lifetime).level,
          materials: shown.materials,
          stars: shown.stars,
          version: shown.version,
          watered: Option.fromNullishOr(shown.watered),
        }),
        size: growthOf(shown.lifetime).size,
        timeZone: shown.timeZone,
      }}
    >
      <OpenIsland />
      <Page width="page">
        <IslandHeader />
        <PageStack>
          <IslandFrame
            lifetime={shown.lifetime}
            name={name}
            stars={shown.stars}
          />
        </PageStack>
      </Page>
    </IslandContext>
  );
}
