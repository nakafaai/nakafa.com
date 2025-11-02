import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { cn, getAppUrl } from "@repo/design-system/lib/utils";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  CheckIcon,
  CopyIcon,
  EllipsisIcon,
  ForwardIcon,
  GlobeIcon,
  LinkIcon,
  LockIcon,
  PenLineIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Activity,
  type ComponentProps,
  type PropsWithChildren,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { useCurrentChat } from "./chat-provider";

export function AiChatHeader() {
  const chat = useCurrentChat((s) => s.chat);

  if (!chat) {
    return <AiChatHeaderPlaceholder />;
  }

  return <AiChatHeaderContent chat={chat} />;
}

function AiChatHeaderPlaceholder() {
  return <Header />;
}

function AiChatHeaderContent({ chat }: { chat: Doc<"chats"> }) {
  const t = useTranslations("Ai");

  const router = useRouter();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmShare, setConfirmShare] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [chatTitle, setChatTitle] = useState(chat.title);

  const inputRef = useRef<HTMLInputElement>(null);

  const user = useQuery(api.auth.getCurrentUser);
  const isOwner = user?.appUser._id === chat.userId;

  const updateChatTitle = useMutation(api.chats.mutations.updateChatTitle);
  const updateChatVisibility = useMutation(
    api.chats.mutations.updateChatVisibility
  );
  const deleteChat = useMutation(api.chats.mutations.deleteChat);

  const [isPending, startTransition] = useTransition();

  const handleEdit = () => {
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleSave = () => {
    startTransition(async () => {
      if (!chatTitle) {
        return;
      }

      await updateChatTitle({
        chatId: chat._id,
        title: chatTitle,
      });
      setIsEditing(false);
    });
  };

  const handleUpdateVisibility = (visibility: "public" | "private") => {
    startTransition(async () => {
      await updateChatVisibility({
        chatId: chat._id,
        visibility,
      });
    });
  };

  const handleDelete = () => {
    if (!user) {
      return;
    }

    startTransition(async () => {
      await deleteChat({ chatId: chat._id });
      router.replace(`/user/${user.appUser._id}/chat`);
    });
  };

  const isPrivate = chat.visibility === "private";
  const link = `${getAppUrl()}/chat/${chat._id}`;

  return (
    <Header>
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
          {isPrivate ? (
            <LockIcon className="size-4 shrink-0" />
          ) : (
            <GlobeIcon className="size-4 shrink-0" />
          )}
          <span className="line-clamp-1 font-medium">{chat.title}</span>
        </h1>
      </Activity>

      <Activity mode={isEditing ? "visible" : "hidden"}>
        <HeaderGroup>
          <Button
            disabled={isPending}
            onClick={() => setIsEditing(false)}
            size="icon-sm"
            variant="destructive"
          >
            <XIcon />
            <span className="sr-only">Cancel</span>
          </Button>
          <Button
            disabled={isPending}
            onClick={handleSave}
            size="icon-sm"
            variant="secondary"
          >
            {isPending ? <SpinnerIcon /> : <CheckIcon />}
            <span className="sr-only">Save</span>
          </Button>
        </HeaderGroup>
      </Activity>

      <Activity mode={isOwner ? "visible" : "hidden"}>
        <HeaderGroup>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                disabled={isPending}
                onClick={handleEdit}
                size="icon-sm"
                variant="ghost"
              >
                <EllipsisIcon />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={handleEdit}
                >
                  <PenLineIcon />
                  {t("rename-chat")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={() => setConfirmShare(true)}
                >
                  <ForwardIcon />
                  {t("share-chat")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={() => setConfirmDelete(true)}
                  variant="destructive"
                >
                  <TrashIcon />
                  {t("delete-chat")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </HeaderGroup>
      </Activity>

      <ResponsiveDialog
        description={t("share-chat-description")}
        footer={
          isPrivate ? (
            <Button
              disabled={isPending}
              onClick={() => handleUpdateVisibility("public")}
            >
              {isPending ? <SpinnerIcon /> : <LinkIcon />}
              {t("create-link")}
            </Button>
          ) : (
            <Button
              disabled={isPending}
              onClick={() => {
                navigator.clipboard.writeText(link);
                toast.success(t("link-copied"), {
                  position: "bottom-center",
                });
              }}
            >
              <CopyIcon />
              {t("copy-link")}
            </Button>
          )
        }
        open={confirmShare}
        setOpen={setConfirmShare}
        title={t("share-chat")}
      >
        <div className="flex flex-col divide-y overflow-hidden rounded-lg border">
          {(["public", "private"] as const).map((visibility) => (
            <button
              className="group flex cursor-pointer items-start gap-4 bg-card p-4 text-card-foreground transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
              disabled={isPending}
              key={visibility}
              onClick={() => handleUpdateVisibility(visibility)}
              type="button"
            >
              <div className="flex flex-1 flex-col items-start justify-start gap-1">
                <div className="flex items-center gap-2">
                  {visibility === "public" ? (
                    <GlobeIcon className="size-4 shrink-0" />
                  ) : (
                    <LockIcon className="size-4 shrink-0" />
                  )}
                  <span className="text-sm">{t(visibility)}</span>
                </div>
                <p className="text-start text-muted-foreground text-sm group-hover:text-accent-foreground/80">
                  {t(`${visibility}-description`)}
                </p>
              </div>

              <CheckIcon
                className={cn(
                  "size-4 shrink-0 text-primary opacity-0 transition-opacity ease-out",
                  visibility === chat.visibility && "opacity-100"
                )}
              />
            </button>
          ))}
        </div>
      </ResponsiveDialog>

      <ResponsiveDialog
        description={t("delete-chat-description")}
        footer={
          <Button
            disabled={isPending}
            onClick={handleDelete}
            variant="destructive"
          >
            {isPending ? <SpinnerIcon /> : <TrashIcon />}
            {t("confirm")}
          </Button>
        }
        open={confirmDelete}
        setOpen={setConfirmDelete}
        title={t("delete-chat")}
      />
    </Header>
  );
}

function Header({
  className,
  children,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <header className="z-1 mx-auto mt-2 grid h-12 w-full max-w-3xl shrink-0 px-2">
      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-md border bg-card px-2 shadow-xs",
          className
        )}
      >
        {children}
      </div>
    </header>
  );
}

function HeaderGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center gap-1.5", className)} {...props} />
  );
}
