import { createFileRoute } from "@tanstack/react-router";
import { cn } from "cn";
import { Option } from "effect";
import { useTranslations } from "use-intl";
import { HomeContinue } from "@/components/home/continue";
import { HomeHeader } from "@/components/home/header";
import { ProgressContext, progressOf } from "@/components/progress/context";
import { WORLD_PANE, WorldPane, WorldToggle } from "@/components/progress/pane";
import { StreakCard } from "@/components/progress/streak";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { pageGutterVariants } from "@/components/shared/content/width";
import {
  Panes,
  PanesList,
  PanesProvider,
  useWide,
} from "@/components/shared/panes";
import { signedInHead } from "@/lib/account/head";
import { homeScreenFn } from "@/lib/account/home.functions";
import { HOME_TARGET } from "@/lib/routing/target";

export const Route = createFileRoute("/$locale/_main/_app/_account/home")({
  loader: ({ params }) => homeScreenFn({ data: { locale: params.locale } }),
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : signedInHead(loaderData.seo),
  component: HomePage,
});

/**
 * The signed-in home (the owner's home sketch, 13 Nov): the Beranda header
 * with the Your world button, the greeting, the streak, and the lessons to
 * pick up again; beside them the world pane, open by default on a wide
 * screen and in a sheet on a phone.
 */
function HomePage() {
  const { island, leaders, name, recent, recentLooks, week } =
    Route.useLoaderData();
  const wide = useWide();
  return (
    <ProgressContext value={progressOf({ island, leaders, week })}>
      <PanesProvider opened={wide ? Option.some(WORLD_PANE) : Option.none()}>
        <HomeBar />
        <Panes id="home">
          <PanesList>
            <div
              className={cn(
                pageGutterVariants(),
                "flex min-w-0 flex-col gap-6 py-6"
              )}
            >
              <HomeHeader name={Option.fromUndefinedOr(name)} />
              <StreakCard />
              <HomeContinue looks={recentLooks} recent={recent} />
            </div>
          </PanesList>
          <WorldPane />
        </Panes>
      </PanesProvider>
    </ProgressContext>
  );
}

/** The home's header: Beranda as its one crumb, and the Your world button. */
function HomeBar() {
  const tCommon = useTranslations("Common");
  return (
    <BreadcrumbHeader
      value={{
        action: <WorldToggle />,
        home: HOME_TARGET,
        homeLabel: tCommon("home"),
        items: [],
        title: tCommon("home"),
      }}
    />
  );
}
