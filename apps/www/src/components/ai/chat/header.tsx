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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import {
  Activity,
  type PropsWithChildren,
  type ReactNode,
  useState,
} from "react";
import { useTranslations } from "use-intl";
import { useChat } from "@/components/ai/chat/context";
import {
  ChatDeletionDialog,
  useChatPageDeletion,
} from "@/components/ai/chat/deletion";
import { handleTitleKeyDown } from "@/components/ai/chat/rename";
import { ChatSharing } from "@/components/ai/chat/sharing";
import { readChatTitle, useChatRename } from "@/components/ai/chat/title";
import { PageActions, PageHeader } from "@/components/shared/page/header";
import { PanelSheetTrigger } from "@/components/sidebar/sheet";

/**
 * The header of the chat a viewer reads. Only the owner's header mounts the
 * Convex hooks of the controls that write, so a reader's header shows the title
 * alone, with no client. The header waits for the viewer, since only then is it
 * known whether the viewer owns the chat.
 */
export function AiChatHeader() {
  const chat = useChat((s) => s.chat);
  const isOwner = useChat((state) => state.owner);
  const isViewerPending = useChat((state) => state.isViewerPending);
  if (!chat || isViewerPending) {
    return <ChatHeader />;
  }
  if (!isOwner) {
    return <ReaderChatHeader chat={chat} />;
  }
  return <OwnerChatHeader chat={chat} />;
}

/** A reader's header: the chat's title, and no control that writes. */
function ReaderChatHeader({ chat }: { chat: ChatView }) {
  const t = useTranslations("Ai");
  return (
    <ChatHeader>
      <h1 className="flex items-center gap-2 px-1.5">
        <HugeIcons
          icon={chat.visibility === "private" ? SquareLock01Icon : Globe02Icon}
        />
        <span className="line-clamp-1 text-sm">
          {readChatTitle(chat.title, t("new-chat"))}
        </span>
      </h1>
    </ChatHeader>
  );
}

/** The owner's header: the title, visibility, sharing, and deletion controls for one chat. */
function OwnerChatHeader({ chat }: { chat: ChatView }) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Ai");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteFromPage = useChatPageDeletion(chat, () =>
    setConfirmDelete(false)
  );
  const [confirmShare, setConfirmShare] = useState(false);
  // The share link is read once the reader shows intent on the share item.
  const [shareWarmed, setShareWarmed] = useState(false);
  const warmShare = () => setShareWarmed(true);
  const {
    boxRef,
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
          <DropdownMenu onOpenChange={onMenuOpenChange}>
            <DropdownMenuTrigger
              render={
                <Button
                  ref={moreActions}
                  size="icon"
                  tooltip={tCommon("more-actions")}
                  variant="outline"
                >
                  <HugeIcons icon={MoreHorizontalIcon} />
                </Button>
              }
            />
            <DropdownMenuContent
              align="end"
              className="w-56"
              finalFocus={menuFinalFocus}
              label={tCommon("menu-actions")}
            >
              <DropdownMenuGroup>
                <DropdownMenuItem icon={Edit01Icon} onClick={handleEdit}>
                  {t("rename-chat")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={LinkForwardIcon}
                  onClick={() => setConfirmShare(true)}
                  onFocus={warmShare}
                  onPointerDown={warmShare}
                  onPointerEnter={warmShare}
                >
                  {t("share-chat")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  icon={Delete02Icon}
                  onClick={() => setConfirmDelete(true)}
                  variant="destructive"
                >
                  {t("delete-chat")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        {/* The rename's two answers sit inside its box, so the header keeps
            its two buttons while the learner edits the title. */}
        <Activity mode={isEditing ? "visible" : "hidden"}>
          <InputGroup ref={boxRef}>
            <InputGroupInput
              aria-label={t("rename-chat")}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(e) => setChatTitle(e.target.value)}
              onKeyDown={(e) =>
                handleTitleKeyDown(e.nativeEvent, {
                  close: closeEditor,
                  save: handleSave,
                })
              }
              placeholder={t("chat-title-placeholder")}
              ref={inputRef}
              value={chatTitle}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                onClick={closeEditor}
                size="icon-sm"
                tooltip={tCommon("cancel")}
              >
                <HugeIcons icon={Cancel01Icon} />
              </InputGroupButton>
              <InputGroupButton
                onClick={handleSave}
                size="icon-sm"
                tooltip={t("confirm")}
              >
                <HugeIcons icon={Tick01Icon} />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Activity>
        <Activity mode={isEditing ? "hidden" : "visible"}>
          <h1
            className="flex items-center gap-2 px-1.5"
            ref={titleRef}
            tabIndex={-1}
          >
            <HugeIcons icon={isPrivate ? SquareLock01Icon : Globe02Icon} />
            <span className="line-clamp-1 text-sm">
              {readChatTitle(chat.title, t("new-chat"))}
            </span>
          </h1>
        </Activity>
      </ChatHeader>

      <ChatSharing
        chat={chat}
        onOpenChange={setConfirmShare}
        open={confirmShare}
        warmed={shareWarmed}
      />
      <ChatDeletionDialog
        chat={chat}
        onDelete={deleteFromPage}
        open={confirmDelete}
        setOpen={setConfirmDelete}
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
    <PageHeader>
      <div className="min-w-0 flex-1">{children}</div>
      <PageActions>
        {actions === undefined ? null : (
          <ButtonGroup aria-label={t("chat-actions")}>{actions}</ButtonGroup>
        )}
        <PanelSheetTrigger
          icon={MessageMultiple02Icon}
          label={t("chat-history")}
        />
      </PageActions>
    </PageHeader>
  );
}
