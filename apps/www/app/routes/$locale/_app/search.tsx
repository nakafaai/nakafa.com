import { createFileRoute } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import { HomeHeader } from "@/components/home/header";
import { InputSearch } from "@/components/search/input";
import { SearchListItems } from "@/components/search/results";
import { BackButton } from "@/components/shared/back";
import { signedInHead } from "@/lib/account/head";
import { searchScreenFn } from "@/lib/account/home.fn";
import { SearchInput } from "@/lib/nuqs/search";

export const Route = createFileRoute("/$locale/_app/search")({
  validateSearch: Schema.toStandardSchemaV1(SearchInput),
  loader: ({ params }) => searchScreenFn({ data: { locale: params.locale } }),
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : signedInHead(loaderData.seo),
  component: SearchPage,
});

function SearchPage() {
  const { name } = Route.useLoaderData();
  return (
    <div className="relative min-h-[calc(100svh-4rem)] lg:min-h-svh">
      <div className="mx-auto w-full max-w-3xl px-6 py-24">
        <div className="relative space-y-12">
          <HomeHeader name={Option.fromUndefinedOr(name)} />
          <div className="flex flex-col gap-2">
            <BackButton
              className="w-fit p-0 text-muted-foreground"
              defaultHref="/home"
              variant="link"
            />
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
