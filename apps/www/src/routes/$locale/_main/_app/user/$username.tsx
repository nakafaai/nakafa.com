import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PageStack } from "@/components/shared/page/body";
import { Page } from "@/components/shared/page/frame";
import { UserHeader } from "@/components/user/header";
import { UserIntro } from "@/components/user/intro";
import { UserTabs } from "@/components/user/tabs";
import { profileScreenFn } from "@/lib/account/profile.functions";

/**
 * A profile shows a learner's name, bio, posts, comments and chats, and many
 * learners are minors, so the layout keeps the profile out of search results.
 * Each tab names its own address. The page is the app's frame: its header, then the profile's heading and its tabs
 * with the tab's rows under them, one rhythm apart.
 */
export const Route = createFileRoute("/$locale/_main/_app/user/$username")({
  loader: ({ params }) =>
    profileScreenFn({
      data: { locale: params.locale, username: params.username },
    }),
  head: () => ({
    meta: [{ content: "noindex,nofollow", name: "robots" }],
  }),
  component: UserLayout,
});

function UserLayout() {
  const { isOwner, profile } = Route.useLoaderData();
  return (
    <ErrorBoundary fallback={null}>
      <Page>
        <UserHeader isOwner={isOwner} profile={profile} />
        <PageStack>
          <UserIntro profile={profile} />
          <div>
            <UserTabs isOwner={isOwner} username={profile.username} />
            <Outlet />
          </div>
        </PageStack>
      </Page>
    </ErrorBoundary>
  );
}
