import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { use } from "react";
import { UserHeader } from "@/components/user/header";
import { UserTabs } from "@/components/user/tabs";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default function Layout(props: LayoutProps<"/[locale]/user/[id]">) {
  const { children, params } = props;
  const { id, locale } = use(params);
  getLocaleOrThrow(locale);

  const userId = id as Id<"users">;

  return (
    <ErrorBoundary fallback={null}>
      <div className="flex flex-col gap-6">
        <UserHeader userId={userId} />
        <UserTabs userId={userId} />
        {children}
      </div>
    </ErrorBoundary>
  );
}
