import { createFileRoute, getRouteApi, notFound } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Effect, Match, Option } from "effect";
import { UserPosts } from "@/components/user/posts/list";
import { profileHead } from "@/lib/account/head";
import type { ProfileInput } from "@/lib/account/input";
import type { ProfileIdentity } from "@/lib/account/profile";
import { profilePostsFn } from "@/lib/account/profile.functions";

const readProfilePosts = createIsomorphicFn()
  .server(
    ({
      locale,
      username,
    }: typeof ProfileInput.Type & {
      readonly known: Promise<ProfileIdentity | undefined>;
    }) => profilePostsFn({ data: { locale, username } })
  )
  .client(
    async ({
      known,
      locale,
      username,
    }: typeof ProfileInput.Type & {
      readonly known: Promise<ProfileIdentity | undefined>;
    }) => {
      const [{ readProfilePostsScreen }, resolved] = await Promise.all([
        import("@/lib/account/profile"),
        known,
      ]);
      const outcome = await Effect.runPromise(
        readProfilePostsScreen(
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

export const Route = createFileRoute("/$locale/_main/_app/user/$username/")({
  loader: ({ params, parentMatchPromise }) =>
    readProfilePosts({
      known: parentMatchPromise.then((match) => match.loaderData),
      locale: params.locale,
      username: params.username,
    }),
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : profileHead(loaderData.seo),
  component: UserPostsPage,
});

const profileRoute = getRouteApi("/$locale/_main/_app/user/$username");

function UserPostsPage() {
  const { first, now } = Route.useLoaderData();
  const { isOwner, profile } = profileRoute.useLoaderData();
  return (
    <UserPosts
      first={Option.fromUndefinedOr(first)}
      isOwner={isOwner}
      now={now}
      profile={profile}
    />
  );
}
