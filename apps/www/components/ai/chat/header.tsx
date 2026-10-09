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
import { useTimeout } from "@mantine/hooks";
import type { Docs } from "@repo/backend/confect/_generated/docs";
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
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import {
  Activity,
  type PropsWithChildren,
  type ReactNode,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { useChat } from "@/components/ai/chat/context";
import { ChatDeletion } from "@/components/ai/chat/deletion";
import { useUpdateChatTitleMutation } from "@/components/ai/chat/mutation.client";
import { ChatSharing } from "@/components/ai/chat/sharing";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";
import { reportClientException } from "@/lib/analytics/client";
import { useViewer } from "@/lib/identity/client";

/** Render the current chat header or its stable empty placeholder. */
export function AiChatHeader() {
  const chat = useChat((s) => s.chat);
  if (!chat) {
    return <ChatHeader />;
  }
  return <AiChatHeaderContent chat={chat} />;
}

/** Render title, visibility, sharing, and deletion controls for one chat. */
function AiChatHeaderContent({ chat }: { chat: Docs["chats"] }) {
  const tCommon = useTranslations("Common");
  const actionErrorMessage = tCommon("action-error");
  const t = useTranslations("Ai");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmShare, setConfirmShare] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [chatTitle, setChatTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const user = useViewer((s) => s.account);
  const isOwner = user?.appUser._id === chat.userId;
  const updateChatTitle = useUpdateChatTitleMutation();
  const [isPending, startTransition] = useTransition();

  const { start: focusTitleInput } = useTimeout(() => {
    inputRef.current?.focus();
  }, 0);

  /** Enter title editing with the current title selected for input. */
  const handleEdit = () => {
    setChatTitle(chat.title ?? "");
    setIsEditing(true);
    focusTitleInput();
  };

  /** Persist a non-empty edited chat title. */
  const handleSave = () => {
    const nextTitle = chatTitle.trim();
    if (!nextTitle || isPending) {
      return;
    }
    setIsEditing(false);
    startTransition(async () =>
      Effect.runPromise(
        Effect.tryPromise(() =>
          updateChatTitle({
            chatId: chat._id,
            title: nextTitle,
          })
        ).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.matchEffect({
            onSuccess: () => Effect.void,
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/ai/chat/header",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    setIsEditing(true);
                    toast.error(actionErrorMessage);
                  })
                )
              ),
          })
        )
      )
    );
  };

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
                  disabled={isPending}
                  onClick={() => setIsEditing(false)}
                  size="icon"
                  variant="outline"
                >
                  <HugeIcons icon={Cancel01Icon} />
                  <span className="sr-only">{tCommon("cancel")}</span>
                </Button>
                <Button
                  aria-label={t("confirm")}
                  disabled={isPending}
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
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label={tCommon("more-actions")}
                      disabled={isPending}
                      size="icon"
                      variant="outline"
                    >
                      <HugeIcons icon={MoreHorizontalIcon} />
                      <span className="sr-only">{tCommon("more-actions")}</span>
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-56">
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
            disabled={isPending}
            onChange={(e) => setChatTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSave();
              }
              if (e.key === "Escape") {
                setIsEditing(false);
              }
            }}
            ref={inputRef}
            value={chatTitle}
          />
        </Activity>
        <Activity mode={isEditing ? "hidden" : "visible"}>
          <h1 className="flex items-center gap-2 px-1.5">
            <HugeIcons
              className="size-4 shrink-0"
              icon={isPrivate ? SquareLock01Icon : Globe02Icon}
            />
            <span className="line-clamp-1 text-sm">{chat.title}</span>
          </h1>
        </Activity>
      </ChatHeader>

      <ChatSharing
        chat={chat}
        onOpenChange={setConfirmShare}
        open={confirmShare}
      />
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
                aria-label={t("chat-history")}
                className="size-9"
                icon={MessageMultiple02Icon}
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
