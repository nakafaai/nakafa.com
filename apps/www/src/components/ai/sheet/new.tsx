import {
  Empty,
  EmptyHeader,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { MessageScrollerItem } from "@repo/design-system/components/ui/scroller";
import { useTranslations } from "use-intl";
import {
  NewChat,
  NewChatInput,
  NewChatSuggestions,
  useNewChatPrompt,
} from "@/components/ai/chat/new";
import { StartPrompt } from "@/components/ai/chat/start";
import { useAi } from "@/components/ai/context";
import { EmptyNina } from "@/components/state/nina";

/**
 * Nina's sheet with no chat open: her welcome and the composer of a new chat, which renders on every page. The
 * sheet stays open while its own admission completes, and a notice that opens the chat after the learner closed the
 * sheet opens it, with the chat; a sheet closed while its admission is pending gets that notice, not a reopen. Asking
 * for sign-in closes the sheet first. While the session loads the composer waits disabled.
 */
export function SheetNew() {
  const open = useAi((state) => state.open);
  const setActiveChatId = useAi((state) => state.setActiveChatId);
  const setOpen = useAi((state) => state.setOpen);

  return (
    <NewChat
      admission={{
        onComplete: (chatId) => {
          setActiveChatId(chatId);
          setOpen(true);
        },
        onSignIn: () => setOpen(false),
        shown: open,
      }}
      holds={false}
    >
      <NewChatSurface />
    </NewChat>
  );
}

/** The sheet's new chat: the welcome, or the prompt on its way, above the composer and Nina's suggestions. */
function NewChatSurface() {
  const prompt = useNewChatPrompt();

  return (
    <div className="text-chat relative flex size-full min-w-0 flex-col overflow-hidden">
      <StartPrompt className="p-6" prompt={prompt}>
        <NewChatWelcome />
      </StartPrompt>
      <div className="grid shrink-0 px-2 pb-2">
        <NewChatInput autoFocus>
          <NewChatSuggestions />
        </NewChatInput>
      </div>
    </div>
  );
}

/** Nina's welcome to a new chat. */
function NewChatWelcome() {
  const t = useTranslations("Ai");

  return (
    <MessageScrollerItem className="flex flex-1" messageId="welcome">
      <Empty>
        <EmptyHeader>
          <EmptyNina act="cheering" />
          <EmptyTitle className="text-chat">{t("new-chat-title")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    </MessageScrollerItem>
  );
}
