import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { Schema } from "effect";
import { readTryoutSetFn } from "@/components/tryout/route/attempt.functions";
import { createTryoutHead } from "@/components/tryout/route/head";
import { readTryoutPersonalHeaders } from "@/components/tryout/route/headers";
import { TryoutAttemptSearch } from "@/components/tryout/route/search";
import { TryoutClockProvider } from "@/components/tryout/runtime/clock";
import { TryoutSetPageClient } from "@/components/tryout/set/client";

/**
 * One set of a track. Its catalog view is the same for every learner, and the
 * learner's own attempt on it is personal, so the page is never cached. A URL
 * bound to an attempt answers for that attempt alone.
 */
export const Route = createFileRoute(
  "/$locale/_main/try-out/$country/$exam/$track/$set/"
)({
  validateSearch: Schema.toStandardSchemaV1(TryoutAttemptSearch),
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const route = await readTryoutSetFn({
      data: {
        country: params.country,
        exam: params.exam,
        locale: params.locale,
        search: deps,
        set: params.set,
        track: params.track,
      },
    });
    if (route.kind === "notFound") {
      throw notFound();
    }
    if (route.kind === "signIn") {
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
  component: TryoutSetPage,
});

function TryoutSetPage() {
  const route = Route.useLoaderData();
  if (route.kind === "preview") {
    return route.preview;
  }
  return (
    <TryoutClockProvider initialNow={route.now}>
      <TryoutSetPageClient
        binding={route.binding}
        content={route.content}
        page={route.page}
        restartTarget={route.restartTarget}
        route={route.route}
      >
        {route.review}
      </TryoutSetPageClient>
    </TryoutClockProvider>
  );
}
