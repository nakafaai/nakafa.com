import {
  Cancel01Icon,
  Delete02Icon,
  Edit01Icon,
  Globe02Icon,
  LinkForwardIcon,
  MessageMultiple02Icon,
  MoreHorizontalIcon,
  SquareLock01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { MAX_TITLE_LENGTH } from "@repo/backend/client/nina/presentation";
import type { ChatView } from "@repo/backend/confect/chats/view";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar-shell";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import {
  Activity,
  type PropsWithChildren,
  type ReactNode,
  useState,
} from "react";
import { useTranslations } from "use-intl";
import { useChat } from "@/components/ai/chat/context";
import { ChatDeletion } from "@/components/ai/chat/deletion";
import { handleTitleKeyDown } from "@/components/ai/chat/rename";
import { ChatSharing } from "@/components/ai/chat/sharing";
import { useChatRename } from "@/components/ai/chat/title";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";

/** Render the current chat header or its stable empty placeholder. */
export function AiChatHeader() {
  const chat = useChat((s) => s.chat);
  if (!chat) {
    return <ChatHeader />;
  }
  return <AiChatHeaderContent chat={chat} />;
}

/** Render title, visibility, sharing, and deletion controls for one chat. */
function AiChatHeaderContent({ chat }: { chat: ChatView }) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Ai");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmShare, setConfirmShare] = useState(false);
  // The share link is read once the reader shows intent on the share item.
  const [shareWarmed, setShareWarmed] = useState(false);
  const warmShare = () => setShareWarmed(true);
  const isOwner = useChat((state) => state.owner);
  const {
    chatTitle,
    closeEditor,
    handleEdit,
    handleSave,
    inputRef,
    isEditing,
    menuFinalFocus,
    moreActions,
    onMenuOpenChange,
    setChatTitle,
    titleRef,
  } = useChatRename(chat);

  const isPrivate = chat.visibility === "private";
  return (
    <>
      <ChatHeader
        actions={
          <>
            {isEditing ? (
              <>
                <Button
                  aria-label={tCommon("cancel")}
                  onClick={closeEditor}
                  size="icon"
                  variant="outline"
                >
                  <HugeIcons icon={Cancel01Icon} />
                  <span className="sr-only">{tCommon("cancel")}</span>
                </Button>
                <Button
                  aria-label={t("confirm")}
                  onClick={handleSave}
                  size="icon"
                  variant="outline"
                >
                  <HugeIcons icon={Tick01Icon} />
                  <span className="sr-only">{t("confirm")}</span>
                </Button>
              </>
            ) : null}

            {isOwner ? (
              <DropdownMenu onOpenChange={onMenuOpenChange}>
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label={tCommon("more-actions")}
                      ref={moreActions}
                      size="icon"
                      variant="outline"
                    >
                      <HugeIcons icon={MoreHorizontalIcon} />
                      <span className="sr-only">{tCommon("more-actions")}</span>
                    </Button>
                  }
                />
                <DropdownMenuContent
                  align="end"
                  className="w-56"
                  finalFocus={menuFinalFocus}
                >
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={handleEdit}
                    >
                      <HugeIcons icon={Edit01Icon} />
                      {t("rename-chat")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setConfirmShare(true)}
                      onFocus={warmShare}
                      onPointerDown={warmShare}
                      onPointerEnter={warmShare}
                    >
                      <HugeIcons icon={LinkForwardIcon} />
                      {t("share-chat")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setConfirmDelete(true)}
                      variant="destructive"
                    >
                      <HugeIcons icon={Delete02Icon} />
                      {t("delete-chat")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        }
      >
        <Activity mode={isEditing ? "visible" : "hidden"}>
          <Input
            className="h-8 border-none px-2 py-0 shadow-none focus-visible:ring-0"
            maxLength={MAX_TITLE_LENGTH}
            onChange={(e) => setChatTitle(e.target.value)}
            onKeyDown={(e) =>
              handleTitleKeyDown(e.nativeEvent, {
                close: closeEditor,
                save: handleSave,
              })
            }
            ref={inputRef}
            value={chatTitle}
          />
        </Activity>
        <Activity mode={isEditing ? "hidden" : "visible"}>
          <h1
            className="flex items-center gap-2 px-1.5"
            ref={titleRef}
            tabIndex={-1}
          >
            <HugeIcons
              className="size-4 shrink-0"
              icon={isPrivate ? SquareLock01Icon : Globe02Icon}
            />
            <span className="line-clamp-1 text-sm">{chat.title}</span>
          </h1>
        </Activity>
      </ChatHeader>

      {isOwner ? (
        <ChatSharing
          chat={chat}
          onOpenChange={setConfirmShare}
          open={confirmShare}
          warmed={shareWarmed}
        />
      ) : null}
      <ChatDeletion
        chat={chat}
        onOpenChange={setConfirmDelete}
        open={confirmDelete}
      />
    </>
  );
}

/** Reuses the lesson header and groups chat controls at its right edge. */
export function ChatHeader({
  actions,
  children,
}: PropsWithChildren<{ actions?: ReactNode }>) {
  const t = useTranslations("Ai");
  return (
    <BreadcrumbHeaderFrame>
      <div className="min-w-0 flex-1">{children}</div>
      <ButtonGroup aria-label={t("chat-actions")} className="shrink-0">
        {actions}
        <Tooltip>
          <TooltipTrigger
            render={
              <SidebarTrigger
                className="size-9"
                icon={MessageMultiple02Icon}
                label={t("chat-history")}
                size="icon"
                variant="outline"
              />
            }
          />
          <TooltipContent side="bottom">{t("chat-history")}</TooltipContent>
        </Tooltip>
      </ButtonGroup>
    </BreadcrumbHeaderFrame>
  );
}
