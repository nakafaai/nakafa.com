import { createFileRoute } from "@tanstack/react-router";
import { cn } from "cn";
import { Array as Arr, Option } from "effect";
import { HomeHeader } from "@/components/home/header";
import { HomeWeek } from "@/components/home/week";
import { HomeWorld } from "@/components/home/world";
import { pageRowVariants } from "@/components/shared/content/width";
import { signedInHead } from "@/lib/account/head";
import { homeScreenFn } from "@/lib/account/home.functions";

export const Route = createFileRoute("/$locale/_main/_app/_account/home")({
  loader: ({ params }) => homeScreenFn({ data: { locale: params.locale } }),
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : signedInHead(loaderData.seo),
  component: HomePage,
});

/** The signed-in home: the greeting, the learner's island, and their week. */
function HomePage() {
  const { island, name, recent, recentLooks, week } = Route.useLoaderData();

  return (
    <div className="relative min-h-[calc(100svh-4rem)] lg:min-h-svh">
      <div className={cn(pageRowVariants(), "py-24")}>
        <div className="relative flex flex-col gap-8">
          <HomeHeader name={Option.fromUndefinedOr(name)} />
          <HomeWorld island={island} />
          <HomeWeek
            look={Option.getOrUndefined(Arr.head(recentLooks))}
            recent={Option.getOrUndefined(Arr.head(recent))}
            week={week}
          />
        </div>
      </div>
    </div>
  );
}
