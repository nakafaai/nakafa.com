import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { UserComments } from "@/components/user/comments";

type Props = {
  params: Promise<{
    id: Id<"users">;
  }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;

  return <UserComments userId={id} />;
}
