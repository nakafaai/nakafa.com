import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundry";
import { UserHeader } from "@/components/user/header";
import { UserTabs } from "@/components/user/tabs";

type Props = {
  children: React.ReactNode;
  params: Promise<{
    id: Id<"users">;
  }>;
};

export default async function Layout(props: Props) {
  const { children, params } = props;
  const { id } = await params;

  return (
    <ErrorBoundary fallback={null}>
      <div className="flex flex-col gap-6">
        <UserHeader userId={id} />
        <UserTabs userId={id} />
        {children}
      </div>
    </ErrorBoundary>
  );
}
