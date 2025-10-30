"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@repo/design-system/components/ui/sidebar";
import { Authenticated, useQuery } from "convex/react";
import { EditIcon, HistoryIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Sidebar>;

export function AiChatSidebar({ ...props }: Props) {
  const t = useTranslations("Ai");

  return (
    <div data-pagefind-ignore>
      <SidebarProvider
        cookieName="sidebar_state:ai-chat"
        keyboardShortcut="h"
        sidebarDesktop={1280}
      >
        {/* Mobile trigger button */}
        <SidebarTrigger
          className="fixed top-20 right-6 size-9 bg-background/80 backdrop-blur-xs xl:hidden"
          icon={<HistoryIcon />}
          size="icon"
          variant="outline"
        />

        {/* Right sidebar */}
        <Sidebar
          containerClassName="lg:hidden xl:block"
          side="right"
          variant="floating"
          {...props}
        >
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavigationLink href="/" title={t("new-chat")}>
                    <EditIcon />
                    {t("new-chat")}
                  </NavigationLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="gap-2">
                <HistoryIcon />
                {t("chats")}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <Authenticated>
                  <AiChatSidebarChats />
                </Authenticated>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}

function AiChatSidebarChats() {
  const params = useParams();
  const id = params.id as Id<"chats">;
  const chats = useQuery(api.chats.queries.getChats);

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
