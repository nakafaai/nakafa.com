"use client";

import { usePaginatedQuery } from "@confect/react";
import {
  Globe02Icon,
  SquareLock01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { CHAT_LIST_PAGE_SIZE } from "@repo/backend/client/chats/list";
import chats from "@repo/backend/confect/_generated/refs/chats";
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { cn } from "cn";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useChatList } from "@/components/ai/chat/history.client";
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
  const t = useTranslations("Ai");
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
    <DropdownMenuContent align="end" className="max-h-64 w-72">
      <DropdownMenuGroup>
        <DropdownMenuLabel>{t("recent-chats")}</DropdownMenuLabel>
        {Arr.map(results, (chat) => {
          const isPrivate = chat.visibility === "private";
          return (
            <DropdownMenuItem
              className="cursor-pointer"
              key={chat._id}
              onClick={() => {
                setActiveChatId(chat._id);
              }}
            >
              <HugeIcons icon={isPrivate ? SquareLock01Icon : Globe02Icon} />
              <span className="max-w-62.5 truncate">{chat.title}</span>
              <DropdownMenuShortcut>
                <HugeIcons
                  className={cn(
                    "transition-opacity ease-out",
                    activeChatId === chat._id ? "opacity-100" : "opacity-0"
                  )}
                  icon={Tick01Icon}
                />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          );
        })}
        {loadMore ? <Intersection onIntersect={loadMore} /> : null}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  );
}
