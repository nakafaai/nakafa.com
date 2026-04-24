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
import { createChatRuntime } from "@/components/ai/helpers/runtime";
import { reportChatRuntimeError } from "@/components/ai/helpers/runtime-error";
import { useUser } from "@/lib/context/use-user";

/** Renders the standalone new-chat input and starts the first message. */
export function ChatNew() {
  const t = useTranslations("Ai");

  const router = useRouter();

  const text = useAi((state) => state.text);
  const getModel = useAi((state) => state.getModel);
  const setChatSession = useAi((state) => state.setChatSession);
  const setText = useAi((state) => state.setText);

  const user = useUser((state) => state.user);
  const createChat = useMutation(api.chats.mutations.createChat);

  const [isPending, startTransition] = useTransition();

  /** Creates the chat, starts the stream, and moves the user to the chat page. */
  function handleSubmit(message: PromptInputMessage) {
    startTransition(async () => {
      const query = message.text?.trim();

      if (!query) {
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

      const chatRuntime = createChatRuntime({
        chatId,
        getModel,
        initialMessages: [],
        onError: (error) =>
          reportChatRuntimeError({
            error,
            fallbackMessage: t("error-message"),
            insufficientCreditsMessage: t("insufficient-credits"),
          }),
      });

      setChatSession({ chatId, runtime: chatRuntime });
      setText("");
      chatRuntime.sendMessage({ text: query });
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
