"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { usePaginatedQuery, useQuery } from "convex/react";
import { GlobeIcon, LockIcon } from "lucide-react";

function MenuItem({ userId }: { userId: Id<"users"> }) {
  const { results, status } = usePaginatedQuery(
    api.chats.queries.getChats,
    {
      userId,
      type: "finance",
    },
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
            <SidebarMenuButton asChild>
              <NavigationLink href={`/finance/chat/${chat._id}`}>
                {isPrivate ? <LockIcon /> : <GlobeIcon />}
                <span className="truncate">{chat.title}</span>
              </NavigationLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function FinanceSidebarChatList() {
  const user = useQuery(api.auth.getCurrentUser);
  if (!user) {
    return null;
  }
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <MenuItem userId={user.appUser._id} />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
