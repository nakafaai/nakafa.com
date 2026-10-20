import {
  Globe02Icon,
  Search02Icon,
  SquareLock01Icon,
} from "@hugeicons/core-free-icons";
import { useDebouncedValue } from "@mantine/hooks";
import {
  CHAT_LIST_PAGE_SIZE,
  CHAT_SEARCH_LENGTH,
} from "@repo/backend/client/chats/list";
import chats from "@repo/backend/confect/_generated/refs/chats";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { Intersection } from "@repo/design-system/components/ui/intersection";
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
import { useParams } from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import { type ComponentProps, createContext, use, useState } from "react";
import { useTranslations } from "use-intl";
import { type ChatFirstPage, useChatList } from "@/components/ai/chat/chats";
import { useAi } from "@/components/ai/context";
import { useConvexAuth } from "@/components/providers/convex";
import { ConvexIsland } from "@/components/providers/island";
import { usePaginatedPreloaded } from "@/lib/data/paginated";
import { useViewer } from "@/lib/identity/client";

const CHAT_SEARCH_DEBOUNCE_MS = 500;

/** The chat search the sidebar applies, once the learner stops typing. */
const ChatSearchContext = createContext<string | null>(null);

/** The loader's first page of the chat list, which the list shows until its live page loads. */
const ChatFirstPageContext = createContext<Option.Option<ChatFirstPage>>(
  Option.none()
);

/** Reads the chat search that the sidebar applies. */
function useChatSearch() {
  const search = use(ChatSearchContext);
  if (search === null) {
    throw new Error("useChatSearch must be used within AiChatSidebar");
  }
  return search;
}

export function AiChatSidebar({
  first,
  ...props
}: Omit<ComponentProps<typeof Sidebar>, "label"> & {
  first: Option.Option<ChatFirstPage>;
}) {
  const t = useTranslations("Ai");
  const setOpenMobile = useSidebar((sidebar) => sidebar.setOpenMobile);
  const [q, setQ] = useState("");
  const [debouncedQ] = useDebouncedValue(q, CHAT_SEARCH_DEBOUNCE_MS);
  return (
    <Sidebar
      containerClassName="lg:hidden xl:block"
      label={t("chat-history")}
      side="right"
      {...props}
    >
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <Button
              className="w-full border border-sidebar-border shadow-none focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring/50"
              nativeButton={false}
              render={
                <NavigationLink
                  href="/chat"
                  onClick={() => setOpenMobile(false)}
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
                maxLength={CHAT_SEARCH_LENGTH}
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
        <ChatFirstPageContext value={first}>
          <ChatSearchContext value={debouncedQ}>
            <ConvexIsland>
              <AiChatSidebarHistory />
            </ConvexIsland>
          </ChatSearchContext>
        </ChatFirstPageContext>
      </SidebarContent>
    </Sidebar>
  );
}
function AiChatSidebarHistory() {
  const firstPage = use(ChatFirstPageContext);
  const isPending = useViewer((state) => state.isPending);
  const viewer = useViewer((state) => state.viewer);
  // The loader's page draws the history on the server, where the viewer has not resolved yet.
  if (Option.isNone(firstPage) && (isPending || viewer === null)) {
    return null;
  }
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <AiChatSidebarChats />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
function AiChatSidebarChats() {
  const t = useTranslations("Ai");
  const drafts = useAi((state) => state.chatDrafts);
  const setOpenMobile = useSidebar((sidebar) => sidebar.setOpenMobile);
  const params: Readonly<Record<string, string | undefined>> = useParams({
    strict: false,
  });
  const id = params.id;
  const searchQuery = useChatSearch().trim();
  const firstPage = use(ChatFirstPageContext);
  // The loader's page stands in until the session settles, and the live list subscribes after that.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const type = "study" as const;
  const queryArgs = searchQuery
    ? {
        q: searchQuery,
        type,
      }
    : {
        type,
      };
  // The loader's page is the unfiltered list, so a search reads its own page.
  const pagination = usePaginatedPreloaded(
    chats.queries.getOwnChats,
    isSettled ? queryArgs : "skip",
    { initialNumItems: CHAT_LIST_PAGE_SIZE },
    searchQuery ? Option.none() : firstPage
  );
  const { loadMore, results, searchFurther } = useChatList(
    pagination,
    searchQuery
  );
  return (
    <>
      <SidebarMenu>
        {!searchQuery &&
          Arr.map(drafts, (key) => (
            <SidebarMenuItem key={key}>
              <SidebarMenuButton disabled isActive={!id}>
                <HugeIcons icon={SquareLock01Icon} />
                <span className="truncate">{t("new-chat")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        {Arr.map(results, (chat) => {
          const isPrivate = chat.visibility === "private";
          return (
            <SidebarMenuItem key={chat._id}>
              <SidebarMenuButton
                isActive={id === chat._id}
                render={
                  <NavigationLink
                    href={`/chat/${chat._id}`}
                    onClick={() => setOpenMobile(false)}
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
      {/* A search page may hold no match while older chats remain, so the list
          keeps asking while its end is in view and another page can load. After
          several pages in a row without a match it stops, and the learner asks
          for the next one. */}
      {loadMore ? <Intersection onIntersect={loadMore} /> : null}
      {searchFurther ? (
        <Button
          className="w-full"
          onClick={searchFurther}
          size="sm"
          variant="ghost"
        >
          {t("search-older")}
        </Button>
      ) : null}
    </>
  );
}
