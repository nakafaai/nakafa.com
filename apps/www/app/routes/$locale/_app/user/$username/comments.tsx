import { createFileRoute } from "@tanstack/react-router";
import { UserComments } from "@/components/user/comments";
import { signedInHead } from "@/lib/account/head";
import { profileCommentsScreenFn } from "@/lib/account/profile.fn";

export const Route = createFileRoute("/$locale/_app/user/$username/comments")({
  loader: ({ params }) =>
    profileCommentsScreenFn({
      data: { locale: params.locale, username: params.username },
    }),
  head: ({ loaderData }) => loaderData && signedInHead(loaderData.seo),
  component: UserCommentsPage,
});

function UserCommentsPage() {
  const { userId } = Route.useLoaderData();
  return <UserComments userId={userId} />;
}
