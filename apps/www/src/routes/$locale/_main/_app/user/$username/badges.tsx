import { createFileRoute } from "@tanstack/react-router";
import { UserBadges } from "@/components/user/badges";
import { profileHead } from "@/lib/account/head";
import { profileBadgesScreenFn } from "@/lib/account/profile.functions";

export const Route = createFileRoute(
  "/$locale/_main/_app/user/$username/badges"
)({
  loader: ({ params }) =>
    profileBadgesScreenFn({
      data: { locale: params.locale, username: params.username },
    }),
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : profileHead(loaderData.seo),
  component: UserBadgesPage,
});

function UserBadgesPage() {
  const { medals } = Route.useLoaderData();
  return <UserBadges medals={medals} />;
}
