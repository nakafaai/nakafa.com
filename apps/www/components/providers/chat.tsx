"use client";

import type { ReactNode } from "react";
import { useAi, useAiHydrated } from "@/lib/context/use-ai";
import { ChatProvider as ChatProviderBase } from "@/lib/context/use-chat";

export function ChatProvider({ children }: { children: ReactNode }) {
  const isHydrated = useAiHydrated();
  const currentMessages = useAi((state) => state.currentMessages);

  if (!isHydrated) {
    return null;
  }

  return (
    <ChatProviderBase messages={currentMessages}>{children}</ChatProviderBase>
  );
}
