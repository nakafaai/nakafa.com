"use client";

import { GeometricShapes01Icon } from "@hugeicons/core-free-icons";
import { DEFAULT_TITLE } from "@repo/ai/features/constants";
import { api } from "@repo/backend/convex/_generated/api";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@repo/design-system/components/ai/conversation";
import type { PromptInputMessage } from "@repo/design-system/components/ai/input";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { memo, useTransition } from "react";
import { useAi } from "@/components/ai/context/use-ai";
import { createChatRuntime } from "@/components/ai/helpers/runtime";
import { reportChatRuntimeError } from "@/components/ai/helpers/runtime-error";
import { SheetInput } from "@/components/ai/sheet-input";
import { useUser } from "@/lib/context/use-user";

/** Renders Nina's empty state and starts a new study chat. */
export const SheetNew = memo(() => {
  const t = useTranslations("Ai");

  const router = useRouter();
  const pathname = usePathname();

  const getModel = useAi((state) => state.getModel);
  const setActiveChatId = useAi((state) => state.setActiveChatId);
  const setChatSession = useAi((state) => state.setChatSession);
  const setOpen = useAi((state) => state.setOpen);
  const setText = useAi((state) => state.setText);

  const user = useUser((state) => state.user);
  const createChat = useMutation(api.chats.mutations.createChat);

  const [isPending, startTransition] = useTransition();

  /** Creates a chat, starts the stream, and opens that chat in the sheet. */
  function handleSubmit(message: PromptInputMessage) {
    startTransition(async () => {
      const query = message.text?.trim();

      if (!query) {
        return;
      }

      if (!user) {
        setOpen(false);
        router.push(`/auth?redirect=${pathname}`);
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
      setActiveChatId(chatId);
      setText("");
      chatRuntime.sendMessage({ text: query });
    });
  }

  return (
    <div className="relative flex size-full flex-col overflow-hidden">
      <Conversation>
        <ConversationContent>
          <ConversationEmptyState
            description={t("new-chat-description")}
            icon={<HugeIcons className="size-6" icon={GeometricShapes01Icon} />}
            title={t("new-chat-title")}
          />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <SheetInput
        disabled={isPending}
        isPending={isPending}
        key="ai-sheet-input"
        onSubmit={handleSubmit}
      />
    </div>
  );
});
