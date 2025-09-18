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
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { AiChatModel } from "@/components/ai/chat-model";
import { useAi } from "@/lib/context/use-ai";
import { useChat } from "@/lib/context/use-chat";

export function HomeSearch() {
  const t = useTranslations("Ai");

  const router = useRouter();

  const user = useQuery(api.auth.getCurrentUser);

  const text = useAi((state) => state.text);
  const setText = useAi((state) => state.setText);

  const { status, sendMessage, setMessages } = useChat((state) => state.chat);

  const [isPending, startTransition] = useTransition();

  const handleSubmit = (message: PromptInputMessage) => {
    startTransition(() => {
      if (!message.text?.trim()) {
        return;
      }

      if (!user) {
        router.push("/auth");
        return;
      }

      setMessages([]);

      router.push("/chat");

      sendMessage({
        text: message.text,
        files: message.files,
      });
      setText("");
    });
  };

  return (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea
        autoFocus
        className="p-4"
        onChange={(e) => setText(e.target.value)}
        placeholder={t("text-placeholder")}
        value={text}
      />
      <PromptInputToolbar>
        <PromptInputTools>
          <AiChatModel />
        </PromptInputTools>
        <PromptInputSubmit
          disabled={isPending}
          isPending={isPending}
          status={status}
        />
      </PromptInputToolbar>
    </PromptInput>
  );
}
