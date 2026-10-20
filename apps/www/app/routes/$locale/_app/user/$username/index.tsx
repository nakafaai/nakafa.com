import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { UserPosts } from "@/components/user/posts/list";
import { profilePostsFn } from "@/lib/account/screens.fn";

export const Route = createFileRoute("/$locale/_app/user/$username/")({
  loader: ({ params }) =>
    profilePostsFn({
      data: { locale: params.locale, username: params.username },
    }),
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
