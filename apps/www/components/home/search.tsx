"use client";

import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@repo/design-system/components/ai/input";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useAi } from "@/lib/context/use-ai";
import { useChat } from "@/lib/context/use-chat";
import { AiChatModel } from "../ai/chat-model";

export function HomeSearch() {
  const t = useTranslations("Ai");

  const router = useRouter();

  const text = useAi((state) => state.text);
  const setText = useAi((state) => state.setText);

  const { sendMessage, setMessages } = useChat((state) => state.chat);

  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!text.trim()) {
      return;
    }

    startTransition(() => {
      setMessages([]);

      router.push("/chat");

      sendMessage({ text });
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
      <PromptInputToolbar className="pt-0">
        <PromptInputTools>
          <AiChatModel />
        </PromptInputTools>
        <PromptInputSubmit disabled={isPending} isPending={isPending} />
      </PromptInputToolbar>
    </PromptInput>
  );
}
