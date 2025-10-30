import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { UserChats } from "@/components/user/chats";

type Props = {
  params: Promise<{
    id: Id<"users">;
  }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;

  return <UserChats userId={id} />;
}
