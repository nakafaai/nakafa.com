"use client";

import { DEFAULT_TITLE } from "@repo/ai/features/constants";
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
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { AiChatModel } from "@/components/ai/chat-model";
import { useAi } from "@/components/ai/context/use-ai";
import { useUser } from "@/lib/context/use-user";

export function ChatNew() {
  const t = useTranslations("Ai");

  const router = useRouter();

  const text = useAi((state) => state.text);
  const queuePendingQuery = useAi((state) => state.queuePendingQuery);
  const setText = useAi((state) => state.setText);

  const user = useUser((state) => state.user);
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
        title: DEFAULT_TITLE,
        type: "study",
      });

      queuePendingQuery({ chatId, owner: "page", query: message.text });

      router.push(`/chat/${chatId}`);
    });
  }

  return (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea
        aria-label={t("text-placeholder")}
        className="p-4"
        onChange={(e) => setText(e.target.value)}
        placeholder={t("text-placeholder")}
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
