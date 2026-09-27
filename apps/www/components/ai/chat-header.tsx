import {
  Cancel01Icon,
  Copy01Icon,
  Delete02Icon,
  Edit01Icon,
  Globe02Icon,
  Link04Icon,
  LinkForwardIcon,
  MessageMultiple02Icon,
  MoreHorizontalIcon,
  SquareLock01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
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
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar-shell";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { useRouter } from "@repo/internationalization/src/navigation";
import { getAppUrl } from "@repo/next-config/app";
import { cn } from "cn";
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
import {
  useDeleteChatMutation,
  useUpdateChatTitleMutation,
  useUpdateChatVisibilityMutation,
} from "@/components/ai/chat/mutation.client";
import { useChat } from "@/components/ai/context/use-chat";
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

  /** Enter title editing with the current title selected for input. */
  const handleEdit = () => {
    setChatTitle(chat.title ?? "");
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
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
                source: "components/ai/chat-header",
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

/** Owns sharing state and visibility admission independently of title editing. */
function ChatSharing({
  chat,
  open,
  onOpenChange,
}: {
  chat: Docs["chats"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Ai");
  const actionErrorMessage = useTranslations("Common")("action-error");
  const [isPending, startTransition] = useTransition();
  const clipboard = useClipboard({ timeout: 500 });
  const updateChatVisibility = useUpdateChatVisibilityMutation();
  const isPrivate = chat.visibility === "private";
  const link = `${getAppUrl()}/chat/${chat._id}`;
  /** Persist the selected chat visibility. */
  const handleUpdateVisibility = (visibility: "public" | "private") => {
    startTransition(async () =>
      Effect.runPromise(
        Effect.asVoid(
          Effect.tryPromise(() =>
            updateChatVisibility({
              chatId: chat._id,
              visibility,
            })
          ).pipe(Effect.flatMap(Effect.fromResult))
        ).pipe(
          Effect.matchEffect({
            onSuccess: () => Effect.void,
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/ai/chat-header",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    toast.error(actionErrorMessage);
                  })
                )
              ),
          })
        )
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("share-chat-description")}
      footer={
        isPrivate ? (
          <Button
            disabled={isPending}
            onClick={() => handleUpdateVisibility("public")}
          >
            <HugeIcons icon={Link04Icon} />
            {t("create-link")}
          </Button>
        ) : (
          <Button
            disabled={isPending}
            onClick={() => {
              clipboard.copy(link);
              toast.success(t("link-copied"), {
                position: "bottom-center",
              });
            }}
          >
            <HugeIcons icon={clipboard.copied ? Tick01Icon : Copy01Icon} />
            {t("copy-link")}
          </Button>
        )
      }
      open={open}
      setOpen={onOpenChange}
      title={t("share-chat")}
    >
      <div className="flex flex-col divide-y overflow-hidden rounded-lg border">
        {(["public", "private"] as const).map((visibility) => {
          const isSelected = visibility === chat.visibility;
          const isPublic = visibility === "public";
          return (
            <button
              className="group flex cursor-pointer items-start gap-4 bg-card p-4 text-card-foreground transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
              disabled={isPending}
              key={visibility}
              onClick={() => handleUpdateVisibility(visibility)}
              type="button"
            >
              <div className="flex flex-1 flex-col items-start justify-start gap-1">
                <div className="flex items-center gap-2">
                  <HugeIcons
                    className="size-4 shrink-0"
                    icon={isPublic ? Globe02Icon : SquareLock01Icon}
                  />
                  <span className="text-sm">{t(visibility)}</span>
                </div>
                <p className="text-start text-muted-foreground text-sm group-hover:text-accent-foreground">
                  {t(`${visibility}-description`)}
                </p>
              </div>

              <HugeIcons
                className={cn(
                  "size-4 shrink-0 text-primary opacity-0 transition-opacity ease-out group-hover:text-accent-foreground",
                  !!isSelected && "opacity-100"
                )}
                icon={Tick01Icon}
              />
            </button>
          );
        })}
      </div>
    </ResponsiveDialog>
  );
}

/** Owns destructive confirmation and routes away only after confirmed deletion. */
function ChatDeletion({
  chat,
  open,
  onOpenChange,
}: {
  chat: Docs["chats"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Ai");
  const actionErrorMessage = useTranslations("Common")("action-error");
  const router = useRouter();
  const user = useViewer((s) => s.account);
  const [isPending, startTransition] = useTransition();
  const deleteChat = useDeleteChatMutation();
  /** Leave the current route and delete the owned chat. */
  const handleDelete = () => {
    if (!user || isPending) {
      return;
    }
    onOpenChange(false);
    startTransition(async () =>
      Effect.runPromise(
        Effect.tryPromise(() =>
          deleteChat({
            chatId: chat._id,
          })
        ).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.tap(() =>
            Effect.sync(() => router.replace(`/user/${user.appUser._id}/chat`))
          ),
          Effect.matchEffect({
            onSuccess: () => Effect.void,
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/ai/chat-header",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    toast.error(actionErrorMessage);
                  })
                )
              ),
          })
        )
      )
    );
  };
  return (
    <ResponsiveDialog
      description={t("delete-chat-description")}
      footer={
        <Button
          disabled={isPending}
          onClick={handleDelete}
          variant="destructive"
        >
          <HugeIcons icon={Delete02Icon} />
          {t("confirm")}
        </Button>
      }
      open={open}
      setOpen={onOpenChange}
      title={t("delete-chat")}
    />
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
