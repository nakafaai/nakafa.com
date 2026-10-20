import { createFileRoute } from "@tanstack/react-router";
import { UserChats } from "@/components/user/chats";
import { profileHead } from "@/lib/account/head";
import { profileChatScreenFn } from "@/lib/account/profile.fn";

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

/** The chats of a profile belong to its owner alone; the loader answers anyone else with not found. */
function UserChatsPage() {
  const { userId } = Route.useLoaderData();
  return <UserChats userId={userId} />;
}
