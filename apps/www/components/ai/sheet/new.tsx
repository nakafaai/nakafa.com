"use client";

import { GeometricShapes01Icon } from "@hugeicons/core-free-icons";
import { Response } from "@repo/design-system/components/ai/response";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Message } from "@repo/design-system/components/ui/message";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from "@repo/design-system/components/ui/scroller";
import { MessageScroller as Primitive } from "@shadcn/react/message-scroller";
import { useTranslations } from "next-intl";
import { useChatAdmission } from "@/components/ai/chat/admission";
import { useAi } from "@/components/ai/context";
import { NinaInput, NinaSuggestions } from "@/components/ai/input";
import { NinaPrompt } from "@/components/ai/message/prompt";

/** Renders Nina's empty state and starts a new study chat. */
export function SheetNew() {
  const t = useTranslations("Ai");

  const setActiveChatId = useAi((state) => state.setActiveChatId);
  const setOpen = useAi((state) => state.setOpen);
  const ask = useAi((state) => state.ask);
  const admission = useChatAdmission({
    onComplete: setActiveChatId,
    onSignIn: () => setOpen(false),
  });
  // A page-level ask shows its prompt here while its chat is admitted.
  const prompt = admission.prompt
    ? { ...admission.prompt, id: admission.promptId }
    : ask && { ...ask, files: [] };
  const disabled = admission.disabled || ask !== null;

  return (
    <div className="relative flex size-full min-w-0 flex-col overflow-hidden text-chat">
      <Primitive.Provider autoScroll defaultScrollPosition="last-anchor">
        <MessageScroller className="flex-1">
          <MessageScrollerViewport aria-label={t("messages")}>
            <MessageScrollerContent className="p-6">
              {prompt ? (
                <MessageScrollerItem messageId={prompt.id} scrollAnchor>
                  <Message align="end">
                    <NinaPrompt files={prompt.files}>
                      <Response id={prompt.id}>{prompt.text}</Response>
                    </NinaPrompt>
                  </Message>
                </MessageScrollerItem>
              ) : (
                <MessageScrollerItem
                  className="flex flex-1"
                  messageId="welcome"
                >
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <HugeIcons icon={GeometricShapes01Icon} />
                      </EmptyMedia>
                      <EmptyTitle className="text-chat">
                        {t("new-chat-title")}
                      </EmptyTitle>
                      <EmptyDescription>
                        {t("new-chat-description")}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </Primitive.Provider>

      <div className="grid shrink-0 px-2 pb-2">
        <NinaInput autoFocus disabled={disabled} onSubmit={admission.submit}>
          {prompt ? null : (
            <NinaSuggestions disabled={disabled} onSubmit={admission.submit} />
          )}
        </NinaInput>
      </div>
    </div>
  );
}
