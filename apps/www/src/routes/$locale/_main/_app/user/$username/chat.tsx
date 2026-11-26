import { createFileRoute, getRouteApi, notFound } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Effect, Match, Option } from "effect";
import { UserChats } from "@/components/user/chats";
import { profileHead } from "@/lib/account/head";
import type { ProfileInput } from "@/lib/account/input";
import type { ProfileIdentity } from "@/lib/account/profile";
import { profileChatScreenFn } from "@/lib/account/profile.functions";

const readProfileChat = createIsomorphicFn()
  .server(
    ({
      locale,
      username,
    }: typeof ProfileInput.Type & {
      readonly known: Promise<ProfileIdentity | undefined>;
    }) => profileChatScreenFn({ data: { locale, username } })
  )
  .client(
    async ({
      known,
      locale,
      username,
    }: typeof ProfileInput.Type & {
      readonly known: Promise<ProfileIdentity | undefined>;
    }) => {
      const [{ readProfileChatScreen }, resolved] = await Promise.all([
        import("@/lib/account/profile"),
        known,
      ]);
      const outcome = await Effect.runPromise(
        readProfileChatScreen(
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

export const Route = createFileRoute("/$locale/_main/_app/user/$username/chat")(
  {
    loader: ({ params, parentMatchPromise }) =>
      readProfileChat({
        known: parentMatchPromise.then((match) => match.loaderData),
        locale: params.locale,
        username: params.username,
      }),
    head: ({ loaderData }) =>
      loaderData === undefined ? {} : profileHead(loaderData.seo),
    component: UserChatsPage,
  }
);

const profileRoute = getRouteApi("/$locale/_main/_app/user/$username");

/** The chats of a profile belong to its owner alone; the loader answers anyone else with not found. */
function UserChatsPage() {
  const { first, now } = Route.useLoaderData();
  const { profile } = profileRoute.useLoaderData();
  return (
    <UserChats
      first={Option.fromUndefinedOr(first)}
      now={now}
      profile={profile}
    />
  );
}
