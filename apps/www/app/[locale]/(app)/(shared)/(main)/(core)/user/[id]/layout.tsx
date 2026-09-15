import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { Suspense, use } from "react";
import { UserHeader } from "@/components/user/header";
import { UserTabs } from "@/components/user/tabs";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default function Layout(props: LayoutProps<"/[locale]/user/[id]">) {
  return (
    <Suspense fallback={null}>
      <UserLayoutContent {...props} />
    </Suspense>
  );
}

/** Resolves the URL-specific profile shell inside its streaming boundary. */
function UserLayoutContent(props: LayoutProps<"/[locale]/user/[id]">) {
  const { children, params } = props;
  const { id, locale } = use(params);
  getLocaleOrThrow(locale);

  const userId = id as Id<"users">;

  return (
    <ErrorBoundary fallback={null}>
      <main className="relative mx-auto min-h-[calc(100svh-4rem)] max-w-3xl px-6 py-10 sm:py-20 lg:min-h-svh">
        <div className="flex flex-col gap-6">
          <UserHeader userId={userId} />
          <UserTabs userId={userId} />
          {children}
        </div>
      </main>
    </ErrorBoundary>
  );
}
