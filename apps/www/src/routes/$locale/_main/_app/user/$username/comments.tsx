import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import { UserComments } from "@/components/user/comments";
import { profileHead } from "@/lib/account/head";
import { profileCommentsScreenFn } from "@/lib/account/profile.functions";

export const Route = createFileRoute(
  "/$locale/_main/_app/user/$username/comments"
)({
  loader: ({ params }) =>
    profileCommentsScreenFn({
      data: { locale: params.locale, username: params.username },
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
      userId={userId}
      username={username}
    />
  );
}
