"use client";

import { usePaginatedQuery } from "@confect/react";
import {
  Globe02Icon,
  Search02Icon,
  SquareLock01Icon,
} from "@hugeicons/core-free-icons";
import { useDebouncedValue } from "@mantine/hooks";
import refs from "@repo/backend/confect/_generated/refs";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
} from "@repo/design-system/components/ui/sidebar-content";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { Sidebar } from "@repo/design-system/components/ui/sidebar-shell";
import { useSidebar } from "@repo/design-system/lib/sidebar/context";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ComponentProps, useState } from "react";
import { useAi } from "@/components/ai/context";
import { useViewer } from "@/lib/identity/client";

const CHAT_SEARCH_DEBOUNCE_MS = 500;
export function AiChatSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const t = useTranslations("Ai");
  const { setOpenMobile } = useSidebar();
  const [q, setQ] = useState("");
  const [debouncedQ] = useDebouncedValue(q, CHAT_SEARCH_DEBOUNCE_MS);
  return (
    <Sidebar containerClassName="lg:hidden xl:block" side="right" {...props}>
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <Button
              className="w-full border border-sidebar-border shadow-none focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring/50"
              nativeButton={false}
              render={
                <NavigationLink
                  href="/chat"
                  onNavigate={() => setOpenMobile(false)}
                  title={t("new-chat")}
                >
                  {t("new-chat")}
                </NavigationLink>
              }
              size="sm"
              variant="secondary"
            />
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarMenu>
          <SidebarMenuItem>
            <InputGroup className="h-8 border-sidebar-border bg-background text-foreground shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-sidebar-ring has-[[data-slot=input-group-control]:focus-visible]:ring-sidebar-ring/50">
              <InputGroupInput
                className="h-8"
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("search-chats")}
                value={q}
              />
              <InputGroupAddon>
                <HugeIcons icon={Search02Icon} />
              </InputGroupAddon>
            </InputGroup>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <AiChatSidebarHistory q={debouncedQ} />
      </SidebarContent>
    </Sidebar>
  );
}
function AiChatSidebarHistory({ q }: { q?: string }) {
  const isPending = useViewer((state) => state.isPending);
  const viewer = useViewer((state) => state.viewer);
  if (isPending || viewer === null) {
    return null;
  }
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <AiChatSidebarChats q={q} />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
function AiChatSidebarChats({ q }: { q?: string | undefined }) {
  const t = useTranslations("Ai");
  const drafts = useAi((state) => state.chatDrafts);
  const { setOpenMobile } = useSidebar();
  const params = useParams<{
    id: Id<"chats">;
  }>();
  const id = params.id;
  const searchQuery = q?.trim();
  const type = "study" as const;
  const queryArgs = searchQuery
    ? {
        q: searchQuery,
        type,
      }
    : {
        type,
      };
  const pagination = usePaginatedQuery(
    refs.public.chats.queries.getOwnChats,
    queryArgs,
    {
      initialNumItems: 50,
    }
  );
  const { results } = pagination;
  return (
    <SidebarMenu>
      {!searchQuery &&
        drafts.map((key) => (
          <SidebarMenuItem key={key}>
            <SidebarMenuButton disabled isActive={!id}>
              <HugeIcons icon={SquareLock01Icon} />
              <span className="truncate">{t("new-chat")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      {results.map((chat) => {
        const isPrivate = chat.visibility === "private";
        return (
          <SidebarMenuItem key={chat._id}>
            <SidebarMenuButton
              isActive={id === chat._id}
              render={
                <NavigationLink
                  href={`/chat/${chat._id}`}
                  onNavigate={() => setOpenMobile(false)}
                  title={chat.title}
                />
              }
            >
              <HugeIcons icon={isPrivate ? SquareLock01Icon : Globe02Icon} />
              <span className="truncate">{chat.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
