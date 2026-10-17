import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import type { Metadata } from "next";
import { Suspense } from "react";
import { UserHeader } from "@/components/user/header";
import { UserTabs } from "@/components/user/tabs";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { readProfile } from "@/lib/profile/server";

/**
 * Keeps a profile out of search results: it shows a learner's name, bio, posts,
 * comments, and chats, and many learners are minors. The page stays reachable by
 * link, so robots.txt does not block it and a crawler can read this rule.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function Layout(
  props: LayoutProps<"/[locale]/user/[username]">
) {
  return (
    <Suspense fallback={null}>
      <UserLayoutContent {...props} />
    </Suspense>
  );
}

/** Resolves the URL-specific profile shell inside its streaming boundary. */
async function UserLayoutContent(
  props: LayoutProps<"/[locale]/user/[username]">
) {
  const { children, params } = props;
  const { username: address, locale } = await params;
  getLocaleOrThrow(locale);
  const { account, username } = await readProfile(address);

  return (
    <ErrorBoundary fallback={null}>
      <main className="relative mx-auto min-h-[calc(100svh-4rem)] max-w-3xl px-6 py-10 sm:py-20 lg:min-h-svh">
        <div className="flex flex-col gap-6">
          <UserHeader initialAccount={account} username={username} />
          <UserTabs username={username} />
          {children}
        </div>
      </main>
    </ErrorBoundary>
  );
}
