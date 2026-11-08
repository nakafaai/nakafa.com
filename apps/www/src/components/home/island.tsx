import type * as Ref from "@confect/core/Ref";
import { QueryResult } from "@confect/react";
import island from "@repo/backend/confect/_generated/refs/island";
import { growthOf } from "@repo/backend/confect/island/level";
import { NO_MATERIALS } from "@repo/backend/confect/island/material";
import { STARTER_LAYOUT } from "@repo/backend/confect/island/starter";
import { Button } from "@repo/design-system/components/ui/button";
import { AfterPageRead } from "@repo/design-system/components/ui/settled";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFooter,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { lazy } from "@repo/design-system/lib/lazy";
import { Link } from "@tanstack/react-router";
import { Option } from "effect";
import { Suspense } from "react";
import { useTranslations } from "use-intl";
import { SkyProvider } from "@/components/island/sky";
import { ToolsProvider } from "@/components/island/tools";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";
import { IslandContext } from "@/lib/island/context";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

/** The island's canvas and three.js, loaded once the reader is on the page (ADR 0042, D17). */
const IslandCanvas = lazy(() => import("@/components/island/canvas"));

/** The island of a learner whose first visit has not opened it yet: the starter set. */
const STARTER: Pick<
  NonNullable<Ref.Returns<typeof island.queries.own>>,
  "layout" | "lifetime" | "materials" | "stars" | "timeZone" | "version"
> = {
  layout: STARTER_LAYOUT,
  lifetime: 0,
  materials: NO_MATERIALS,
  stars: 0,
  timeZone: "UTC",
  version: 0,
};

/**
 * The learner's island at the top of their home (ADR 0042, D11): its name and
 * level, the island itself once the reader is on the page, the way in, and the
 * Stars the next level asks for. The frame and the island page's frame share
 * one view-transition name, so entering grows this frame into the page while
 * the island's camera descends, and a reader who asks for less motion gets the
 * page's plain cross-fade.
 */
export function HomeIsland({
  name,
  preloaded,
}: {
  /** The owner's name, missing only when the account could not be read. */
  name: string | undefined;
  /** The loader's island, none before the owner's first visit opens it. */
  preloaded: Ref.Returns<typeof island.queries.own> | undefined;
}) {
  const t = useTranslations("Island");
  const live = usePreloadedQueryResult(island.queries.own, {}, preloaded);
  const shown =
    QueryResult.isSuccess(live) && live.value !== null ? live.value : STARTER;
  const growth = growthOf(shown.lifetime);
  return (
    <section className="motion-safe:[view-transition-name:island]">
      <IslandContext
        value={{
          layout: shown.layout,
          owner: Option.some({
            learned: Option.none(),
            level: growth.level,
            materials: shown.materials,
            stars: shown.stars,
            version: shown.version,
            watered: Option.none(),
          }),
          size: growth.size,
          timeZone: shown.timeZone,
        }}
      >
        <ToolsProvider>
          <SkyProvider>
            <VisualCard>
              <VisualCardHeader
                description={t("level", { level: growth.level })}
                title={name === undefined ? t("title") : t("name", { name })}
              />
              <VisualCardBody className="aspect-video">
                <AfterPageRead>
                  <Suspense fallback={null}>
                    <IslandCanvas />
                  </Suspense>
                </AfterPageRead>
              </VisualCardBody>
              <VisualCardActions>
                <Button
                  render={
                    <Link
                      from={LOCALE_ROUTE}
                      to="/$locale/island"
                      viewTransition
                    />
                  }
                >
                  {t("enter")}
                </Button>
              </VisualCardActions>
              <VisualCardFooter>
                <p className="text-muted-foreground text-sm">
                  {Option.match(growth.next, {
                    onNone: () => t("enter-top"),
                    onSome: (next) =>
                      t("enter-next", { stars: next - shown.lifetime }),
                  })}
                </p>
              </VisualCardFooter>
            </VisualCard>
          </SkyProvider>
        </ToolsProvider>
      </IslandContext>
    </section>
  );
}
