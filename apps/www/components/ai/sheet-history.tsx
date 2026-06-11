"use client";

import {
  ChatSearch01Icon,
  Globe02Icon,
  SquareLock01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuShortcut,
  MenuTrigger,
} from "@repo/design-system/components/ui/menu";
import { cn } from "@repo/design-system/lib/utils";
import { Authenticated, usePaginatedQuery } from "convex/react";
import { useTranslations } from "next-intl";

import { useAi } from "@/components/ai/context/use-ai";
import { useUser } from "@/lib/context/use-user";

/** Opens the recent Nina chat list when a user is signed in. */
export const SheetHistory = () => {
  const { isPending, user } = useUser((state) => ({
    isPending: state.isPending,
    user: state.user,
  }));

  if (isPending || !user) {
    return null;
  }

  return (
    <Menu modal={false}>
      <MenuTrigger
        render={
          <Button size="icon-sm" variant="ghost">
            <HugeIcons icon={ChatSearch01Icon} />
            <span className="sr-only">History</span>
          </Button>
        }
      />
      <Authenticated>
        <SheetHistoryContent />
      </Authenticated>
    </Menu>
  );
};

/** Renders recent Nina chats in the header menu. */
const SheetHistoryContent = () => {
  const t = useTranslations("Ai");
  const activeChatId = useAi((state) => state.activeChatId);
  const setActiveChatId = useAi((state) => state.setActiveChatId);
  const { results, status } = usePaginatedQuery(
    api.chats.queries.getOwnChats,
    { type: "study" },
    { initialNumItems: 50 }
  );

  if (status === "LoadingFirstPage" || results.length === 0) {
    return null;
  }

  return (
    <MenuPopup align="end" className="max-h-64 w-72">
      <MenuGroup>
        <MenuGroupLabel>{t("recent-chats")}</MenuGroupLabel>
        {results.map((chat) => {
          const isPrivate = chat.visibility === "private";
          return (
            <MenuItem
              className="cursor-pointer"
              key={chat._id}
              onClick={() => {
                setActiveChatId(chat._id);
              }}
            >
              <HugeIcons icon={isPrivate ? SquareLock01Icon : Globe02Icon} />
              <span className="max-w-62.5 truncate">{chat.title}</span>
              <MenuShortcut>
                <HugeIcons
                  className={cn(
                    "transition-opacity ease-out",
                    activeChatId === chat._id ? "opacity-100" : "opacity-0"
                  )}
                  icon={Tick01Icon}
                />
              </MenuShortcut>
            </MenuItem>
          );
        })}
      </MenuGroup>
    </MenuPopup>
  );
};
