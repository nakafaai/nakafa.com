import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { UserHeader } from "@/components/user/header";
import { UserTabs } from "@/components/user/tabs";
import { signedInHead } from "@/lib/account/head";
import { profileScreenFn } from "@/lib/account/screens.fn";

export const Route = createFileRoute("/$locale/_app/user/$username")({
  loader: ({ params }) =>
    profileScreenFn({
      data: { locale: params.locale, username: params.username },
    }),
  head: ({ loaderData }) => loaderData && signedInHead(loaderData.seo),
  component: UserLayout,
});

/**
 * A profile shows a learner's name, bio, posts, comments and chats, and many
 * learners are minors, so the head keeps it out of search results.
 */
function UserLayout() {
  const { isOwner, profile } = Route.useLoaderData();
  return (
    <ErrorBoundary fallback={null}>
      <main className="relative mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-3xl flex-col px-6 pt-6 pb-24 lg:min-h-svh lg:pt-12">
        <UserHeader isOwner={isOwner} profile={profile} />
        <UserTabs isOwner={isOwner} username={profile.username} />
        <Outlet />
      </main>
    </ErrorBoundary>
  );
}
