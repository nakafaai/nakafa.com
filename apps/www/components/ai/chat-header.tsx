import {
  Cancel01Icon,
  Copy01Icon,
  Delete02Icon,
  Edit01Icon,
  Globe02Icon,
  Link04Icon,
  LinkForwardIcon,
  MoreHorizontalIcon,
  SquareLock01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
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
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn, getAppUrl } from "@repo/design-system/lib/utils";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import {
  Activity,
  type ComponentProps,
  type PropsWithChildren,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { useUser } from "@/lib/context/use-user";
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

  useEffect(() => {
    if (!chat.title) {
      return;
    }
    setChatTitle(chat.title);
  }, [chat.title]);

  const inputRef = useRef<HTMLInputElement>(null);

  const clipboard = useClipboard({ timeout: 500 });

  const user = useUser((s) => s.user);
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

    startTransition(() => {
      router.replace(`/user/${user.appUser._id}/chat`);
      deleteChat({ chatId: chat._id });
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
          <HugeIcons
            className="size-4 shrink-0"
            icon={isPrivate ? SquareLock01Icon : Globe02Icon}
          />
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
            <HugeIcons icon={Cancel01Icon} />
            <span className="sr-only">Cancel</span>
          </Button>
          <Button
            disabled={isPending}
            onClick={handleSave}
            size="icon-sm"
            variant="secondary"
          >
            <Spinner icon={Tick01Icon} isLoading={isPending} />
            <span className="sr-only">Save</span>
          </Button>
        </HeaderGroup>
      </Activity>

      <Activity mode={isOwner ? "visible" : "hidden"}>
        <HeaderGroup>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={isPending} size="icon-sm" variant="ghost">
                <HugeIcons icon={MoreHorizontalIcon} />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={handleEdit}
                >
                  <HugeIcons icon={Edit01Icon} />
                  {t("rename-chat")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={() => setConfirmShare(true)}
                >
                  <HugeIcons icon={LinkForwardIcon} />
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
                  <HugeIcons icon={Delete02Icon} />
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
              <Spinner icon={Link04Icon} isLoading={isPending} />
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
        open={confirmShare}
        setOpen={setConfirmShare}
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
                  <p className="text-start text-muted-foreground text-sm group-hover:text-accent-foreground/80">
                    {t(`${visibility}-description`)}
                  </p>
                </div>

                <HugeIcons
                  className={cn(
                    "size-4 shrink-0 text-primary opacity-0 transition-opacity ease-out",
                    !!isSelected && "opacity-100"
                  )}
                  icon={Tick01Icon}
                />
              </button>
            );
          })}
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
            <Spinner icon={Delete02Icon} isLoading={isPending} />
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
