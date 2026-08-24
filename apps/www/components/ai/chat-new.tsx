"use client";

import { DEFAULT_TITLE } from "@repo/ai/features/constants";
import { api } from "@repo/backend/convex/_generated/api";
import {
  PromptInputSubmit,
  PromptInputToolbar,
  PromptInputTools,
} from "@repo/design-system/components/ai/input-controls";
import {
  TextPrompt,
  TextPromptTextarea,
} from "@repo/design-system/components/ai/prompt/text";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { AiChatModel } from "@/components/ai/chat-model";
import { useAi } from "@/components/ai/context/use-ai";
import { reportChatRuntimeError } from "@/components/ai/helpers/runtime-error";
import { loadChatRuntime } from "@/components/ai/helpers/runtime-loader";
import { useUser } from "@/lib/context/use-user";

/** Renders the standalone new-chat input and starts the first message. */
export function ChatNew() {
  const t = useTranslations("Ai");

  const pathname = usePathname();
  const router = useRouter();

  const text = useAi((state) => state.text);
  const getModel = useAi((state) => state.getModel);
  const setChatSession = useAi((state) => state.setChatSession);
  const setText = useAi((state) => state.setText);

  const { isPending: isUserPending, user } = useUser((state) => ({
    isPending: state.isPending,
    user: state.user,
  }));
  const createChat = useMutation(api.chats.mutations.createChat);

  const [isPending, startTransition] = useTransition();

  /** Creates the chat, starts the stream, and moves the user to the chat page. */
  function handleSubmit(textValue: string) {
    startTransition(async () => {
      const query = textValue.trim();

      if (!query) {
        return;
      }

      if (isUserPending) {
        return;
      }

      if (!user) {
        router.push(`/auth?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      const [chatId, { createChatRuntime }] = await Promise.all([
        createChat({
          title: DEFAULT_TITLE,
          type: "study",
        }),
        Effect.runPromise(loadChatRuntime()),
      ]);

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
    <TextPrompt onSubmit={handleSubmit}>
      <TextPromptTextarea
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
        <PromptInputSubmit
          disabled={isPending || isUserPending}
          isPending={isPending || isUserPending}
        />
      </PromptInputToolbar>
    </TextPrompt>
  );
}
