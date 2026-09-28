"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { ChatHeader } from "@/components/ai/chat/header";
import { AiChatPage } from "@/components/ai/chat/page";

/** URL params resolve synchronously on client navigation, preserving the prompt. */
export default function Page() {
  return (
    <Suspense fallback={<ChatHeader />}>
      <ChatRoute />
    </Suspense>
  );
}

function ChatRoute() {
  const { id } = useParams<{ id: Id<"chats"> }>();
  return <AiChatPage chatId={id} key={id} />;
}
