import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { Schema } from "effect";
import { readTryoutSectionFn } from "@/components/tryout/route/attempt.functions";
import { createTryoutHead } from "@/components/tryout/route/head";
import { readTryoutPersonalHeaders } from "@/components/tryout/route/headers";
import { TryoutAttemptSearch } from "@/components/tryout/route/search";
import { TryoutClockProvider } from "@/components/tryout/runtime/clock";
import { TryoutSectionPageClient } from "@/components/tryout/section/client";
import { readStaticData } from "@/lib/static/data";

/**
 * One section of a set. Its catalog view is shared, so the build prerenders it and
 * keeps its answer. The learner's attempt through it is personal: a signed-in
 * learner and a URL bound to an attempt read their own answer from the server,
 * which renders their page for their request (`isLearnerPage`), and a URL bound to
 * an attempt answers for that attempt alone.
 */
export const Route = createFileRoute(
  "/$locale/_main/try-out/$country/$exam/$track/$set/$section/"
)({
  validateSearch: Schema.toStandardSchemaV1(TryoutAttemptSearch),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps, params }) => {
    const input = {
      country: params.country,
      exam: params.exam,
      locale: params.locale,
      search: deps,
      section: params.section,
      set: params.set,
      track: params.track,
    };
    const route = await (context.signedIn || deps.attemptId !== undefined
      ? readTryoutSectionFn({ data: input })
      : readStaticData(readTryoutSectionFn, input));
    if (route.kind === "notFound") {
      throw notFound();
    }
    if (route.kind === "signIn") {
      // The sign-in address carries the attempt's return path, so it stays an href.
      throw redirect({ href: route.href, statusCode: 307 });
    }
    return route;
  },
  head: ({ loaderData, params }) =>
    loaderData === undefined
      ? {}
      : createTryoutHead({
          canonicalPath: loaderData.head.canonicalPath,
          description: loaderData.head.description,
          image: loaderData.head.image,
          indexable: loaderData.head.indexable,
          jsonLd: [],
          locale: params.locale,
          title: loaderData.head.title,
        }),
  headers: readTryoutPersonalHeaders,
  component: TryoutSectionPage,
});

function TryoutSectionPage() {
  const route = Route.useLoaderData();
  if (route.kind === "preview") {
    return route.preview;
  }
  return (
    <TryoutClockProvider initialNow={route.now}>
      <TryoutSectionPageClient
        binding={route.binding}
        content={route.content}
        page={route.page}
        route={route.route}
        setPath={route.setPath}
      >
        {route.review}
      </TryoutSectionPageClient>
    </TryoutClockProvider>
  );
}
