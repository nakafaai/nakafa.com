import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { UserHeader } from "@/components/user/header";
import { UserTabs } from "@/components/user/tabs";

export default function Layout(props: LayoutProps<"/[locale]/user/[id]">) {
  const { children, params } = props;
  const { id, locale } = use(params);

  // Ensure that the incoming `locale` is valid
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

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
