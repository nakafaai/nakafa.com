import { usePaginatedQuery } from "@confect/react";
import { Globe02Icon, SquareLock01Icon } from "@hugeicons/core-free-icons";
import { CHAT_LIST_PAGE_SIZE } from "@repo/backend/client/chats/list";
import chats from "@repo/backend/confect/_generated/refs/chats";
import {
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useChatList } from "@/components/ai/chat/list";
import { useAi } from "@/components/ai/context";
import { Authenticated } from "@/components/auth/gate";

/**
 * The recent Nina chats, rendered inside the header's history menu. The header
 * owns the menu's root and button, and mounts this once the learner shows
 * intent on the button, so the chat list is read only for a learner who asks.
 */
export function SheetHistory() {
  return (
    <Authenticated>
      <SheetHistoryContent />
    </Authenticated>
  );
}

/** Renders recent Nina chats in the header menu. */
function SheetHistoryContent() {
  const common = useTranslations("Common");
  const activeChatId = useAi((state) => state.activeChatId);
  const setActiveChatId = useAi((state) => state.setActiveChatId);
  const pagination = usePaginatedQuery(
    chats.queries.getOwnChats,
    {
      type: "study",
    },
    {
      initialNumItems: CHAT_LIST_PAGE_SIZE,
    }
  );
  const { loadMore, results } = useChatList(pagination);
  if (results.length === 0) {
    return null;
  }
  return (
    <DropdownMenuContent
      align="end"
      className="max-h-64 w-72"
      label={common("menu-chats")}
    >
      <DropdownMenuRadioGroup
        onValueChange={setActiveChatId}
        value={activeChatId}
      >
        {Arr.map(results, (chat) => (
          <DropdownMenuRadioItem
            icon={
              chat.visibility === "private" ? SquareLock01Icon : Globe02Icon
            }
            key={chat._id}
            value={chat._id}
          >
            <span className="max-w-62.5 truncate">{chat.title}</span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      {loadMore ? <Intersection onIntersect={loadMore} /> : null}
    </DropdownMenuContent>
  );
}
