"use client";

import { Message } from "@repo/design-system/components/ui/message";
import { Particles } from "@repo/design-system/components/ui/particles";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from "@repo/design-system/components/ui/scroller";
import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";
import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { useRouter } from "@repo/internationalization/src/navigation";
import { MessageScroller as Primitive } from "@shadcn/react/message-scroller";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useTransition,
} from "react";
import { ChatHeader } from "@/components/ai/chat-header";
import { useAi } from "@/components/ai/context/use-ai";
import { NinaInput } from "@/components/ai/input";
import { NinaPrompt } from "@/components/ai/prompt";
import { useNinaSubmission } from "@/components/ai/submission";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";
import { useViewer } from "@/lib/identity/client";

/** Moves directly from the welcome screen into the final conversation layout. */
export function ChatNew({
  children,
  title,
}: {
  children: ReactNode;
  title: ReactNode;
}) {
  const router = useRouter();
  const t = useTranslations("Ai");
  const authNavigation = useCurrentAuthNavigation();

  const setText = useAi((state) => state.setText);

  const isUserPending = useViewer((state) => state.isPending);
  const viewer = useViewer((state) => state.viewer);

  const { send } = useNinaSubmission();
  const [isPending, startTransition] = useTransition();
  const [prompt, showPrompt] = useOptimistic<Pick<
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
      router.push(authNavigation.readHref());
      return false;
    }
    const draft = { ...message, text: query };
    const submittedFrom = activation.current;
    const admission = send(draft);
    startTransition(async () => {
      showPrompt({ text: draft.text, files: draft.files ?? [] });
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
        router.push(`/chat/${receipt.chatId}`);
      });
    });
    return admission.then((receipt) => receipt !== undefined);
  }

  return (
    <div
      className={cn(
        "relative flex size-full min-w-0 flex-col overflow-hidden text-chat",
        !prompt && "justify-center gap-4"
      )}
    >
      {prompt ? (
        <ChatHeader />
      ) : (
        <>
          <Particles className="pointer-events-none absolute inset-0 opacity-80" />
          <div className="absolute inset-x-0 top-0">
            <ChatHeader />
          </div>
        </>
      )}
      {prompt ? (
        <Primitive.Provider autoScroll defaultScrollPosition="last-anchor">
          <MessageScroller className="flex-1">
            <MessageScrollerViewport aria-label={t("messages")}>
              <MessageScrollerContent className="mx-auto w-full max-w-3xl p-6">
                <MessageScrollerItem messageId={promptId} scrollAnchor>
                  <Message align="end">
                    <NinaPrompt
                      files={prompt.files ?? []}
                      id={promptId}
                      text={prompt.text}
                    />
                  </Message>
                </MessageScrollerItem>
                <MessageScrollerItem messageId="pending">
                  <Message>
                    <TypingLoader />
                  </Message>
                </MessageScrollerItem>
              </MessageScrollerContent>
            </MessageScrollerViewport>
          </MessageScroller>
        </Primitive.Provider>
      ) : (
        <div className="relative mx-auto w-full max-w-xl px-6">{title}</div>
      )}
      <div
        className={cn(
          "relative mx-auto grid w-full shrink-0",
          prompt ? "max-w-3xl px-4 pb-4" : "max-w-xl px-6"
        )}
        key="composer"
      >
        <NinaInput
          disabled={isPending || isUserPending}
          onSubmit={handleSubmit}
        />
      </div>
      {prompt ? null : (
        <div className="relative mx-auto w-full max-w-xl px-6">{children}</div>
      )}
    </div>
  );
}
