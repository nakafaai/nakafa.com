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
import { Message } from "@repo/design-system/components/ui/message";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from "@repo/design-system/components/ui/scroller";
import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { useRouter } from "@repo/internationalization/src/navigation";
import { MessageScroller as Primitive } from "@shadcn/react/message-scroller";
import { useTranslations } from "next-intl";
import {
  type ComponentProps,
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useTransition,
} from "react";
import { useAi } from "@/components/ai/context";
import { NinaInput, NinaSuggestions } from "@/components/ai/input";
import { NinaPrompt } from "@/components/ai/message/prompt";
import { useNinaSubmission } from "@/components/ai/submission";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";
import { useViewer } from "@/lib/identity/client";

/** Renders Nina's empty state and starts a new study chat. */
export function SheetNew() {
  const t = useTranslations("Ai");

  const router = useRouter();
  const authNavigation = useCurrentAuthNavigation();

  const setActiveChatId = useAi((state) => state.setActiveChatId);
  const setOpen = useAi((state) => state.setOpen);
  const setText = useAi((state) => state.setText);

  const isUserPending = useViewer((state) => state.isPending);
  const viewer = useViewer((state) => state.viewer);

  const { send } = useNinaSubmission();
  const [isPending, startTransition] = useTransition();
  const [optimisticPrompt, showPrompt] = useOptimistic<Pick<
    ComponentProps<typeof NinaPrompt>,
    "text" | "files"
  > | null>(null);
  const promptId = useId();
  const activation = useRef(0);
  const viewerId = viewer?.id;
  useEffect(() => {
    if (!viewerId) {
      return;
    }
    return () => {
      activation.current += 1;
    };
  }, [viewerId]);

  function handleSubmit(message: PromptInputMessage) {
    const query = message.text?.trim();
    if (!query || isUserPending || isPending) {
      return false;
    }
    if (viewer === null) {
      setOpen(false);
      router.push(authNavigation.readHref());
      return false;
    }
    const prompt = {
      text: query,
      ...(message.files ? { files: message.files } : {}),
    };
    const admission = send(prompt);
    const submittedFrom = activation.current;
    startTransition(async () => {
      showPrompt({ text: prompt.text, files: prompt.files ?? [] });
      setText("");
      const receipt = await admission;
      if (activation.current !== submittedFrom) {
        return;
      }
      if (!receipt) {
        setText((previous) => previous || query);
        return;
      }
      startTransition(() => {
        showPrompt({
          text: receipt.prompt.text,
          files: receipt.prompt.files.map(({ filename, ...file }) => ({
            ...file,
            type: "file",
            ...(filename === undefined ? {} : { filename }),
          })),
        });
        setActiveChatId(receipt.chatId);
      });
    });
    return admission.then((receipt) => receipt !== undefined);
  }

  return (
    <div className="relative flex size-full min-w-0 flex-col overflow-hidden text-chat">
      <Primitive.Provider autoScroll defaultScrollPosition="last-anchor">
        <MessageScroller className="flex-1">
          <MessageScrollerViewport aria-label={t("messages")}>
            <MessageScrollerContent className="p-6">
              {optimisticPrompt ? (
                <MessageScrollerItem messageId={promptId} scrollAnchor>
                  <Message align="end">
                    <NinaPrompt
                      files={optimisticPrompt.files ?? []}
                      id={promptId}
                      text={optimisticPrompt.text}
                    />
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
        <NinaInput
          autoFocus
          disabled={isPending || isUserPending}
          onSubmit={handleSubmit}
        >
          {optimisticPrompt ? null : (
            <NinaSuggestions
              disabled={isPending || isUserPending}
              onSubmit={handleSubmit}
            />
          )}
        </NinaInput>
      </div>
    </div>
  );
}
