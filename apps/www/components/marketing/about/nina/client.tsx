"use client";

import {
  ArrowDown01Icon,
  ArrowUp02Icon,
  BrainIcon,
  Calculator01Icon,
} from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import {
  TextPrompt,
  TextPromptTextarea,
} from "@repo/design-system/components/ai/prompt/text";
import {
  Bubble,
  BubbleContent,
} from "@repo/design-system/components/ui/bubble";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroupAddon,
  InputGroupButton,
} from "@repo/design-system/components/ui/input-group";
import {
  Message,
  MessageContent,
} from "@repo/design-system/components/ui/message";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from "@repo/design-system/components/ui/scroller";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useRouter } from "@repo/internationalization/src/navigation";
import { MessageScroller as Primitive } from "@shadcn/react/message-scroller";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { AiChatModel } from "@/components/ai/chat-model";
import { useAi } from "@/components/ai/context/use-ai";

interface NinaPromptProps {
  readonly placeholder: string;
}

interface NinaReasoningProps {
  readonly children: ReactNode;
  readonly label: string;
}

interface NinaMathProps {
  readonly children: ReactNode;
  readonly label: string;
}

/** Owns example scrolling while the server renders both message bodies. */
export function NinaExample({
  children,
  question,
}: {
  children: ReactNode;
  question: ReactNode;
}) {
  const t = useTranslations("Ai");
  return (
    <Primitive.Provider defaultScrollPosition="end">
      <MessageScroller className="flex-1">
        <MessageScrollerViewport aria-label={t("messages")}>
          <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-6 px-8 pt-8 pb-14 lg:px-10 lg:pt-12">
            <MessageScrollerItem messageId="features-question" scrollAnchor>
              <Message align="end">
                <MessageContent>
                  <Bubble variant="muted">
                    <BubbleContent>{question}</BubbleContent>
                  </Bubble>
                </MessageContent>
              </Message>
            </MessageScrollerItem>
            <MessageScrollerItem messageId="features-answer">
              <Message>
                <div className="flex size-full flex-col gap-6">{children}</div>
              </Message>
            </MessageScrollerItem>
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </Primitive.Provider>
  );
}

/** Owns the two compact disclosures without hydrating their static content. */
export function NinaReasoning({ children, label }: NinaReasoningProps) {
  const [expanded, { set }] = useDisclosure(false);

  return (
    <Collapsible
      className="not-prose flex w-full flex-col gap-2"
      onOpenChange={set}
      open={expanded}
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
        <Spinner className="size-4" icon={BrainIcon} isLoading={false} />
        <p>{label}</p>
        <HugeIcons
          className={cn(
            "size-4 transition-transform",
            expanded ? "rotate-180" : "rotate-0"
          )}
          icon={ArrowDown01Icon}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="text-muted-foreground text-sm outline-none">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Preserves the existing verified-math disclosure and its Base UI behavior. */
export function NinaMath({ children, label }: NinaMathProps) {
  const [expanded, { set }] = useDisclosure(false);

  return (
    <Collapsible
      className="not-prose flex max-w-full flex-col gap-2"
      onOpenChange={set}
      open={expanded}
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
        <HugeIcons className="size-4 shrink-0" icon={Calculator01Icon} />
        <span className="truncate">{label}</span>
        <HugeIcons
          className={cn(
            "size-4 shrink-0 transition-transform",
            expanded ? "rotate-180" : "rotate-0"
          )}
          icon={ArrowDown01Icon}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full overflow-hidden text-muted-foreground text-sm outline-none">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Hydrates only Nina's text prompt and model selector. */
export function NinaPrompt({ placeholder }: NinaPromptProps) {
  const router = useRouter();
  const t = useTranslations("Ai");
  const text = useAi((state) => state.text);
  const setText = useAi((state) => state.setText);

  /** Opens Nina with the learner's current marketing-page draft. */
  function handleSubmit(textValue: string) {
    const query = textValue.trim();

    if (!query) {
      return;
    }

    setText(query);
    router.push("/chat");
  }

  return (
    <TextPrompt onSubmit={handleSubmit}>
      <TextPromptTextarea
        aria-label={placeholder}
        className="p-4"
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        value={text}
      />
      <InputGroupAddon align="block-end" className="justify-end">
        <AiChatModel />
        <InputGroupButton
          aria-label={t("send-message")}
          className="rounded-full"
          size="icon"
          type="submit"
          variant="default"
        >
          <HugeIcons icon={ArrowUp02Icon} />
        </InputGroupButton>
      </InputGroupAddon>
    </TextPrompt>
  );
}
