import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { cn } from "cn";
import { Option, Schema } from "effect";
import { createTranslator } from "use-intl/core";
import { HomeHeader } from "@/components/home/header";
import { SignedInIsland } from "@/components/providers/island";
import { InputSearch } from "@/components/search/input";
import { SearchListItems } from "@/components/search/results";
import { BackButton } from "@/components/shared/back";
import { pageRowVariants } from "@/components/shared/page/width";
import type { ScreenSeo } from "@/lib/account/head";
import { searchHead } from "@/lib/account/head";
import { readRouteMessages } from "@/lib/i18n/messages.functions";
import { useViewer } from "@/lib/identity/client";
import { SearchInput } from "@/lib/search/input";
import { readStaticData } from "@/lib/static/data";

/**
 * The search page. The build prerenders the bare page, so its loader reads the
 * static answers and the Worker renders none of it: the search runs in the
 * browser, and the greeting names a signed-in reader once their live session
 * opens. The bare page holds no learner's data, so it may be indexed; the head
 * keeps every page with a query out of indexes (`searchHead`).
 */
export const Route = createFileRoute("/$locale/_main/_app/search")({
  validateSearch: Schema.toStandardSchemaV1(SearchInput),
  search: { middlewares: [stripSearchParams({ q: "" })] },
  loader: async ({ params }) => {
    const messages = await readStaticData(readRouteMessages, {
      locale: params.locale,
      namespaces: ["Common", "Utils"],
    });
    const t = createTranslator({
      locale: params.locale,
      messages,
      namespace: "Utils",
    });
    const tCommon = createTranslator({
      locale: params.locale,
      messages,
      namespace: "Common",
    });
    const seo: ScreenSeo = {
      canonicalPath: `/${params.locale}/search`,
      description: t("search-description"),
      indexable: true,
      locale: params.locale,
      title: t("search-title"),
    };
    return { home: tCommon("home"), seo };
  },
  head: ({ loaderData, match }) =>
    loaderData === undefined
      ? {}
      : searchHead(loaderData.seo, match.search.q, loaderData.home),
  component: SearchScreen,
});

/** The greeting of a signed-in reader, read on the page's Convex island. */
function SignedInGreeting() {
  const name = useViewer((state) => state.viewer?.name);
  return <HomeHeader name={Option.fromNullishOr(name)} />;
}

function SearchScreen() {
  return (
    <div className="relative min-h-[calc(100svh-4rem)] lg:min-h-svh">
      <div className={cn(pageRowVariants(), "py-24")}>
        <div className="relative space-y-12">
          <SignedInIsland fallback={<HomeHeader name={Option.none()} />}>
            <SignedInGreeting />
          </SignedInIsland>
          <div className="flex flex-col gap-2">
            <BackButton className="w-fit" />
            <div className="grid gap-6">
              <InputSearch />
              <SearchListItems />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
