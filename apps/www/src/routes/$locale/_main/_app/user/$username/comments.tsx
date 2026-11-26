import { createFileRoute, notFound } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Effect, Match, Option } from "effect";
import { UserComments } from "@/components/user/comments";
import { profileHead } from "@/lib/account/head";
import type { ProfileInput } from "@/lib/account/input";
import type { ProfileIdentity } from "@/lib/account/profile";
import { profileCommentsScreenFn } from "@/lib/account/profile.functions";

const readProfileComments = createIsomorphicFn()
  .server(
    ({
      locale,
      username,
    }: typeof ProfileInput.Type & {
      readonly known: Promise<ProfileIdentity | undefined>;
    }) => profileCommentsScreenFn({ data: { locale, username } })
  )
  .client(
    async ({
      known,
      locale,
      username,
    }: typeof ProfileInput.Type & {
      readonly known: Promise<ProfileIdentity | undefined>;
    }) => {
      const [{ readProfileCommentsScreen }, resolved] = await Promise.all([
        import("@/lib/account/profile"),
        known,
      ]);
      const outcome = await Effect.runPromise(
        readProfileCommentsScreen(locale, username, document.cookie, resolved)
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
  "/$locale/_main/_app/user/$username/comments"
)({
  loader: ({ params, parentMatchPromise }) =>
    readProfileComments({
      known: parentMatchPromise.then((match) => match.loaderData),
      locale: params.locale,
      username: params.username,
    }),
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : profileHead(loaderData.seo),
  component: UserCommentsPage,
});

function UserCommentsPage() {
  const { author, first, userId } = Route.useLoaderData();
  const { username } = Route.useParams();
  return (
    <UserComments
      author={author}
      first={Option.fromUndefinedOr(first)}
      key={username}
      userId={userId}
      username={username}
    />
  );
}
