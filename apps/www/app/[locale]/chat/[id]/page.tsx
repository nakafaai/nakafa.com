import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
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
  const defaultMetadata = {};
  // Use try-catch to handle errors gracefully when title is not found
  try {
    const title = await fetchQuery(api.chats.queries.getChatTitle, {
      chatId: id,
    });
    if (!title) {
      return defaultMetadata;
    }
    return {
      title: {
        absolute: title,
      },
    };
  } catch {
    return defaultMetadata;
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params;

  return (
    <ChatIdProvider chatId={id}>
      <AiChatPage />
    </ChatIdProvider>
  );
}
