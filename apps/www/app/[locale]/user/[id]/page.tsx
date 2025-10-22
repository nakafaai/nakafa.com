import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundry";
import { UserMain } from "@/components/user/main";

type Props = {
  params: Promise<{
    id: Id<"users">;
  }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;
  return (
    <ErrorBoundary fallback={null}>
      <UserMain userId={id} />
    </ErrorBoundary>
  );
}
