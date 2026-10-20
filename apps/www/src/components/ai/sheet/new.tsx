import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { MessageScrollerItem } from "@repo/design-system/components/ui/scroller";
import { useRouter } from "@repo/internationalization/src/navigation";
import type { ComponentProps, ReactNode } from "react";
import { useTranslations } from "use-intl";
import { StartPrompt, useStartChat } from "@/components/ai/chat/start";
import { useAi } from "@/components/ai/context";
import { NinaInput, NinaSuggestions } from "@/components/ai/input";
import { ConvexIsland } from "@/components/providers/island";
import { useLiveSession } from "@/components/providers/live";
import { EmptyNina } from "@/components/state/empty";
import { useCurrentAuthNavigation } from "@/lib/auth/location";

/**
 * Renders Nina's empty state and starts a new study chat. Only a signed-in
 * learner's composer reads Convex: a visitor's and a pending session's composers
 * load no admission code and open no client, so the sheet renders on every page.
 */
export function SheetNew() {
  const isSessionPending = useLiveSession((state) => state.isPending);
  return (
    <ConvexIsland
      fallback={isSessionPending ? <PendingSheetNew /> : <VisitorSheetNew />}
    >
      <SignedInSheetNew />
    </ConvexIsland>
  );
}

/** The welcome of a new chat and its composer, which every variant of the sheet shares. */
function NewChatSurface({
  composer,
  prompt,
}: {
  composer: ReactNode;
  prompt: ComponentProps<typeof StartPrompt>["prompt"];
}) {
  return (
    <div className="relative flex size-full min-w-0 flex-col overflow-hidden text-chat">
      <StartPrompt className="p-6" prompt={prompt}>
        <NewChatWelcome />
      </StartPrompt>

      <div className="grid shrink-0 px-2 pb-2">{composer}</div>
    </div>
  );
}

function NewChatWelcome() {
  const t = useTranslations("Ai");

  return (
    <MessageScrollerItem className="flex flex-1" messageId="welcome">
      <Empty>
        <EmptyHeader>
          <EmptyNina act="cheering" />
          <EmptyTitle className="text-chat">{t("new-chat-title")}</EmptyTitle>
          <EmptyDescription>{t("new-chat-description")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </MessageScrollerItem>
  );
}

/**
 * A visitor's composer. Its attach button and its send both ask for sign-in, as
 * the admission gate does for a signed-out learner, so no chat code loads.
 */
function VisitorSheetNew() {
  const router = useRouter();
  const authNavigation = useCurrentAuthNavigation();
  const setOpen = useAi((state) => state.setOpen);

  function signIn() {
    setOpen(false);
    router.push(authNavigation.readHref());
    return false;
  }

  return (
    <NewChatSurface
      composer={
        <NinaInput
          attachments={false}
          onAttachRequest={signIn}
          onSubmit={signIn}
        >
          <NinaSuggestions onSubmit={signIn} />
        </NinaInput>
      }
      prompt={null}
    />
  );
}

/** A composer while the session loads: its send waits for the session, so it offers neither sign-in nor a send. */
function PendingSheetNew() {
  return (
    <NewChatSurface
      composer={
        <NinaInput attachments={false} disabled onSubmit={() => false} />
      }
      prompt={null}
    />
  );
}

/** A signed-in learner's composer, whose admission and submission run on the page's client. */
function SignedInSheetNew() {
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
    <NewChatSurface
      composer={
        <NinaInput autoFocus disabled={disabled} onSubmit={submit}>
          {prompt ? null : (
            <NinaSuggestions disabled={disabled} onSubmit={submit} />
          )}
        </NinaInput>
      }
      prompt={prompt}
    />
  );
}
