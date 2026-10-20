import { createFileRoute } from "@tanstack/react-router";
import { HomeExplore } from "@/components/home/explore";
import { HomeHeader } from "@/components/home/header";
import { HomeContinueLearning } from "@/components/home/recent";
import { HomeTrending } from "@/components/home/trending";
import { signedInHead } from "@/lib/account/head";
import { homeScreenFn } from "@/lib/account/home.fn";

export const Route = createFileRoute("/$locale/_app/_account/home")({
  loader: ({ params }) => homeScreenFn({ data: { locale: params.locale } }),
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : signedInHead(loaderData.seo),
  component: HomePage,
});

function HomePage() {
  const { name, recentLooks, recentRows, trending, trendingLooks } =
    Route.useLoaderData();

  return (
    <div className="relative min-h-[calc(100svh-4rem)] lg:min-h-svh">
      <div className="mx-auto w-full max-w-3xl px-6 py-24">
        <div className="relative flex flex-col gap-12">
          <HomeHeader name={name} />
          <HomeExplore />
          <HomeContinueLearning looks={recentLooks} subjects={recentRows} />
          <HomeTrending looks={trendingLooks} subjects={trending} />
        </div>
      </div>
    </div>
  );
}
