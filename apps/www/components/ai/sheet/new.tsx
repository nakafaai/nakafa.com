"use client";

import { GeometricShapes01Icon } from "@hugeicons/core-free-icons";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { MessageScrollerItem } from "@repo/design-system/components/ui/scroller";
import { useTranslations } from "next-intl";
import { StartPrompt, useStartChat } from "@/components/ai/chat/start";
import { useAi } from "@/components/ai/context";
import { NinaInput, NinaSuggestions } from "@/components/ai/input";

/** Renders Nina's empty state and starts a new study chat. */
export function SheetNew() {
  const t = useTranslations("Ai");

  const open = useAi((state) => state.open);
  const setActiveChatId = useAi((state) => state.setActiveChatId);
  const setOpen = useAi((state) => state.setOpen);
  const { disabled, prompt, submit } = useStartChat({
    // The sheet is open while its own admission completes. A notice that opens
    // the chat after the learner closed the sheet opens it, with the chat. A
    // sheet closed while its admission is pending gets that notice, not a reopen.
    onComplete: (chatId) => {
      setActiveChatId(chatId);
      setOpen(true);
    },
    onSignIn: () => setOpen(false),
    shown: open,
  });

  return (
    <div className="relative flex size-full min-w-0 flex-col overflow-hidden text-chat">
      <StartPrompt className="p-6" prompt={prompt}>
        <MessageScrollerItem className="flex flex-1" messageId="welcome">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeIcons icon={GeometricShapes01Icon} />
              </EmptyMedia>
              <EmptyTitle className="text-chat">
                {t("new-chat-title")}
              </EmptyTitle>
              <EmptyDescription>{t("new-chat-description")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </MessageScrollerItem>
      </StartPrompt>

      <div className="grid shrink-0 px-2 pb-2">
        <NinaInput autoFocus disabled={disabled} onSubmit={submit}>
          {prompt ? null : (
            <NinaSuggestions disabled={disabled} onSubmit={submit} />
          )}
        </NinaInput>
      </div>
    </div>
  );
}
