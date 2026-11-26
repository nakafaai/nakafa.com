import { createFileRoute, notFound } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Effect, Match } from "effect";
import { UserBadges } from "@/components/user/badges";
import { profileHead } from "@/lib/account/head";
import type { ProfileInput } from "@/lib/account/input";
import type { ProfileIdentity } from "@/lib/account/profile";
import { profileBadgesScreenFn } from "@/lib/account/profile.functions";

const readProfileBadges = createIsomorphicFn()
  .server(
    ({
      locale,
      username,
    }: typeof ProfileInput.Type & {
      readonly known: Promise<ProfileIdentity | undefined>;
    }) => profileBadgesScreenFn({ data: { locale, username } })
  )
  .client(
    async ({
      known,
      locale,
      username,
    }: typeof ProfileInput.Type & {
      readonly known: Promise<ProfileIdentity | undefined>;
    }) => {
      const [{ readProfileBadgesScreen }, resolved] = await Promise.all([
        import("@/lib/account/profile"),
        known,
      ]);
      const outcome = await Effect.runPromise(
        readProfileBadgesScreen(
          locale,
          username,
          document.cookie,
          window.location.origin,
          resolved
        )
      );
      return Match.value(outcome).pipe(
        Match.tagsExhaustive({
          NotFound: () => {
            throw notFound();
          },
          Ready: ({ screen }) => screen,
        })
      );
    }
  );

export const Route = createFileRoute(
  "/$locale/_main/_app/user/$username/badges"
)({
  loader: ({ params, parentMatchPromise }) =>
    readProfileBadges({
      known: parentMatchPromise.then((match) => match.loaderData),
      locale: params.locale,
      username: params.username,
    }),
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : profileHead(loaderData.seo),
  component: UserBadgesPage,
});

function UserBadgesPage() {
  const { medals } = Route.useLoaderData();
  return <UserBadges medals={medals} />;
}
