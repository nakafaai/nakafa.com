import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { Either } from "effect";
import { notFound } from "next/navigation";
import { use } from "react";
import { UserHeader } from "@/components/user/header";
import { UserTabs } from "@/components/user/tabs";
import { decodeUserId } from "@/lib/data/convex-ids";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default function Layout(props: LayoutProps<"/[locale]/user/[id]">) {
  const { children, params } = props;
  const { id, locale } = use(params);
  getLocaleOrThrow(locale);

  const userId = decodeUserId(id);

  if (Either.isLeft(userId)) {
    notFound();
  }

  return (
    <ErrorBoundary fallback={null}>
      <div className="flex flex-col gap-6">
        <UserHeader userId={userId.right} />
        <UserTabs userId={userId.right} />
        {children}
      </div>
    </ErrorBoundary>
  );
}
