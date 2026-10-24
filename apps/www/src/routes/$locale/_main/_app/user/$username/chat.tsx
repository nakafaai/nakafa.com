import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { Option } from "effect";
import { UserChats } from "@/components/user/chats";
import { profileHead } from "@/lib/account/head";
import { profileChatScreenFn } from "@/lib/account/profile.functions";

export const Route = createFileRoute("/$locale/_main/_app/user/$username/chat")(
  {
    loader: ({ params }) =>
      profileChatScreenFn({
        data: { locale: params.locale, username: params.username },
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
