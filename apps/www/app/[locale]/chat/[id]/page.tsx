import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundry";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { AiChatPage } from "@/components/ai/chat-page";
import { ChatIdProvider } from "@/components/ai/chat-provider";

type Props = {
  params: Promise<{
    id: Id<"chats">;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const title = await fetchQuery(api.chats.queries.getChatTitle, {
    chatId: id,
  });
  if (!title) {
    return {};
  }
  return {
    title: {
      absolute: title,
    },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;

  return (
    <ErrorBoundary fallback={null}>
      <ChatIdProvider chatId={id}>
        <AiChatPage />
      </ChatIdProvider>
    </ErrorBoundary>
  );
}
