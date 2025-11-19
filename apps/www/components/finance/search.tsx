"use client";

import { api } from "@repo/backend/convex/_generated/api";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@repo/design-system/components/ai/input";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useMutation, useQuery } from "convex/react";
import { useTransition } from "react";
import { AiChatModel } from "@/components/ai/chat-model";
import { useAi } from "@/lib/context/use-ai";

export function FinanceSearch() {
  const router = useRouter();

  const text = useAi((state) => state.text);
  const setText = useAi((state) => state.setText);
  const setQuery = useAi((state) => state.setQuery);

  const user = useQuery(api.auth.getCurrentUser);
  const createChat = useMutation(api.chats.mutations.createChat);

  const [isPending, startTransition] = useTransition();

  function handleSubmit(message: PromptInputMessage) {
    startTransition(async () => {
      if (!message.text?.trim()) {
        return;
      }

      if (!user) {
        router.push("/auth");
        return;
      }

      const chatId = await createChat({
        title: "New Chat",
        type: "finance",
      });

      setQuery(message.text);

      router.push(`/finance/chat/${chatId}`);
    });
  }

  return (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea
        className="p-4"
        onChange={(e) => setText(e.target.value)}
        value={text}
      />
      <PromptInputToolbar>
        <PromptInputTools>
          <AiChatModel />
        </PromptInputTools>
        <PromptInputSubmit disabled={isPending} isPending={isPending} />
      </PromptInputToolbar>
    </PromptInput>
  );
}
