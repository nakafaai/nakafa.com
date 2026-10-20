import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { UserPosts } from "@/components/user/posts/list";
import { profileHead } from "@/lib/account/head";
import { profilePostsFn } from "@/lib/account/profile.fn";

export const Route = createFileRoute("/$locale/_app/user/$username/")({
  loader: ({ params }) =>
    profilePostsFn({
      data: { locale: params.locale, username: params.username },
    }),
  head: ({ loaderData }) => loaderData && profileHead(loaderData.seo),
  component: UserPostsPage,
});

const profileRoute = getRouteApi("/$locale/_app/user/$username");

function UserPostsPage() {
  const { first, now } = Route.useLoaderData();
  const { isOwner, profile } = profileRoute.useLoaderData();
  return (
    <UserPosts first={first} isOwner={isOwner} now={now} profile={profile} />
  );
}
