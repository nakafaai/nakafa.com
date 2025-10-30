import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundry";
import { UserHeader } from "@/components/user/header";
import { UserTabs } from "@/components/user/tabs";

export default async function Layout(
  props: LayoutProps<"/[locale]/user/[id]">
) {
  const { children, params } = props;
  const { id } = await params;
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
