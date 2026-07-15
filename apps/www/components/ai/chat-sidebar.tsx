"use client";

import {
  Globe02Icon,
  MessageMultiple02Icon,
  Search02Icon,
  SquareLock01Icon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
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
import { SidebarProvider } from "@repo/design-system/components/ui/sidebar-provider";
import {
  Sidebar,
  SidebarTrigger,
} from "@repo/design-system/components/ui/sidebar-shell";
import { usePaginatedQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ComponentProps, useState } from "react";
import { useUser } from "@/lib/context/use-user";

type Props = ComponentProps<typeof Sidebar>;

export function AiChatSidebar({ ...props }: Props) {
  return (
    <div>
      <SidebarProvider
        cookieName="sidebar_state:ai-chat"
        keyboardShortcut="h"
        sidebarDesktop={1280}
      >
        <SidebarTrigger
          className="fixed top-32 left-2 size-9 bg-card/80 backdrop-blur-xs sm:left-6 lg:hidden"
          icon={MessageMultiple02Icon}
          size="icon"
          variant="outline"
        />

        <AiChatSidebarContent {...props} />
      </SidebarProvider>
    </div>
  );
}

function AiChatSidebarContent({ ...props }: ComponentProps<typeof Sidebar>) {
  const t = useTranslations("Ai");
  const [q, setQ] = useState("");

  return (
    <Sidebar containerClassName="lg:hidden xl:block" side="right" {...props}>
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <Button
              className="w-full border border-sidebar-border shadow-none focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring/50"
              nativeButton={false}
              render={
                <NavigationLink href="/chat" title={t("new-chat")}>
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
        <AiChatSidebarHistory q={q} />
      </SidebarContent>
    </Sidebar>
  );
}

function AiChatSidebarHistory({ q }: { q?: string }) {
  const { isPending, user } = useUser((s) => ({
    isPending: s.isPending,
    user: s.user,
  }));

  if (isPending || !user) {
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

function AiChatSidebarChats({ q }: { q?: string }) {
  const params = useParams<{ id: Id<"chats"> }>();
  const id = params.id;
  const searchQuery = q?.trim();
  const type = "study" as const;
  const queryArgs = searchQuery ? { q: searchQuery, type } : { type };
  const { results, status } = usePaginatedQuery(
    api.chats.queries.getOwnChats,
    queryArgs,
    { initialNumItems: 50 }
  );

  if (status === "LoadingFirstPage") {
    return null;
  }

  return (
    <SidebarMenu>
      {results.map((chat) => {
        const isPrivate = chat.visibility === "private";
        return (
          <SidebarMenuItem key={chat._id}>
            <SidebarMenuButton
              isActive={id === chat._id}
              render={
                <NavigationLink href={`/chat/${chat._id}`} title={chat.title} />
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
