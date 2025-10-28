import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundry";
import { AiChatPage } from "@/components/ai/chat-page";

type Props = {
  params: Promise<{
    id: Id<"chats">;
  }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;

  return (
    <ErrorBoundary fallback={null}>
      <AiChatPage chatId={id} />
    </ErrorBoundary>
  );
}
