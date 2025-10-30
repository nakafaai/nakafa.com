"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@repo/design-system/components/ui/sidebar";
import { Authenticated, useQuery } from "convex/react";
import { HistoryIcon, SearchIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ComponentProps, useState } from "react";

type Props = ComponentProps<typeof Sidebar>;

export function AiChatSidebar({ ...props }: Props) {
  return (
    <div data-pagefind-ignore>
      <SidebarProvider
        cookieName="sidebar_state:ai-chat"
        keyboardShortcut="h"
        sidebarDesktop={1280}
      >
        <SidebarTrigger
          className="fixed top-32 left-2 size-9 bg-background/80 backdrop-blur-xs xl:hidden"
          icon={<HistoryIcon />}
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
    <Sidebar
      containerClassName="lg:hidden xl:block"
      side="right"
      variant="floating"
      {...props}
    >
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <Button
              asChild
              className="w-full border border-sidebar-border shadow-none"
              variant="secondary"
            >
              <NavigationLink href="/" title={t("new-chat")}>
                {t("new-chat")}
              </NavigationLink>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarMenu>
          <SidebarMenuItem>
            <InputGroup className="border-sidebar-border bg-background shadow-none">
              <InputGroupInput
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("search-chats")}
                value={q}
              />
              <InputGroupAddon>
                <SearchIcon />
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
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <Authenticated>
          <AiChatSidebarChats q={q} />
        </Authenticated>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function AiChatSidebarChats({ q }: { q?: string }) {
  const params = useParams();
  const id = params.id as Id<"chats">;
  const chats = useQuery(api.chats.queries.getChats, { q });

  if (!chats) {
    return null;
  }

  return (
    <SidebarMenu>
      {chats.map((chat) => (
        <SidebarMenuItem key={chat._id}>
          <SidebarMenuButton asChild isActive={id === chat._id}>
            <NavigationLink href={`/chat/${chat._id}`} title={chat.title}>
              <span className="truncate">{chat.title}</span>
            </NavigationLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
