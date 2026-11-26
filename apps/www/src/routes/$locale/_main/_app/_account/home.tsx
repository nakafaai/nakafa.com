import { PlayIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { cn } from "cn";
import { Array as Arr, Effect, Match, Option } from "effect";
import { useTranslations } from "use-intl";
import { HomeContinue } from "@/components/home/continue";
import { HomeStreak } from "@/components/home/streak";
import { HomeTryouts } from "@/components/home/tryouts";
import { ClockProvider } from "@/components/player/now";
import { ProgressContext, progressOf } from "@/components/progress/context";
import { ProgressPane } from "@/components/progress/pane";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { Page } from "@/components/shared/page/frame";
import {
  Panes,
  PanesList,
  PanesProvider,
} from "@/components/shared/page/panes";
import { pageGutterVariants } from "@/components/shared/page/width";
import {
  getPrimaryNavigationItems,
  getPrimaryNavigationTarget,
} from "@/components/sidebar/data/navigation";
import { signedInHead } from "@/lib/account/head";
import { TargetLink } from "@/lib/routing/link";
import { AddressLink } from "@/lib/routing/public/link";
import { HOME_TARGET } from "@/lib/routing/target";

export const Route = createFileRoute("/$locale/_main/_app/_account/home")({
  loader: async ({ params }) => {
    const { readHomeScreen } = await import("@/lib/account/home");
    const outcome = await Effect.runPromise(readHomeScreen(params.locale));
    return Match.value(outcome).pipe(
      Match.tagsExhaustive({
        Onboarding: () => {
          throw redirect({
            params: { locale: params.locale },
            statusCode: 307,
            to: "/$locale/onboarding",
          });
        },
        Ready: ({ screen }) => screen,
        SignedOut: () => {
          throw redirect({
            params: { locale: params.locale },
            statusCode: 307,
            to: "/$locale/auth",
          });
        },
      })
    );
  },
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : signedInHead(loaderData.seo),
  component: HomePage,
});

/**
 * The signed-in home (the owner's home notes, 14 Nov). A learner comes here
 * to learn, so the header's one button is the page's primary action, and the
 * only thing on the page in the primary colour: it opens the lesson they read
 * last, or the subjects when they have read none. The body is three sections
 * in the header's own column, each one concern: their run of days, the
 * try-outs they sat, and the lessons they opened. Their progress pane stands
 * beside the page on a wide screen, and opens as a sheet from the first section
 * on a phone.
 */
function HomePage() {
  const {
    attempts,
    growth,
    leaders,
    name,
    now,
    recent,
    recentLooks,
    start,
    username,
    week,
  } = Route.useLoaderData();
  return (
    <ProgressContext
      value={progressOf({
        growth,
        leaders,
        username: Option.fromUndefinedOr(username),
        week,
      })}
    >
      <PanesProvider>
        <Page width="column">
          <HomeBar />
          <Panes id="home">
            <PanesList>
              <div
                className={cn(
                  pageGutterVariants(),
                  "flex min-w-0 flex-col gap-6 py-6"
                )}
              >
                <HomeStreak name={Option.fromUndefinedOr(name)} now={now} />
                <ClockProvider renderedAt={now}>
                  <HomeTryouts attempts={attempts} start={start} />
                </ClockProvider>
                <HomeContinue looks={recentLooks} recent={recent} />
              </div>
            </PanesList>
            <ProgressPane />
          </Panes>
        </Page>
      </PanesProvider>
    </ProgressContext>
  );
}

/** The home's header: Beranda as its one crumb, and the page's primary button. */
function HomeBar() {
  const tCommon = useTranslations("Common");
  return (
    <BreadcrumbHeader
      value={{
        action: <HomeAction />,
        home: HOME_TARGET,
        homeLabel: tCommon("home"),
        items: [],
        title: tCommon("home"),
      }}
    />
  );
}

/**
 * The page's primary button: Continue learning opens the lesson the learner
 * read last, and a learner who has read none starts at the subjects.
 */
function HomeAction() {
  const t = useTranslations("Home");
  const tCommon = useTranslations("Common");
  const { recent } = Route.useLoaderData();
  const last = Arr.head(recent);
  if (Option.isNone(last)) {
    return (
      <TargetLink
        className={buttonVariants()}
        target={getPrimaryNavigationTarget(getPrimaryNavigationItems()[0])}
      >
        <HugeIcons icon={PlayIcon} />
        {tCommon("start-learning")}
      </TargetLink>
    );
  }
  return (
    <AddressLink address={last.value.href} className={buttonVariants()}>
      <HugeIcons icon={PlayIcon} />
      {t("continue")}
    </AddressLink>
  );
}
