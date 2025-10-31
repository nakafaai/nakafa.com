import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  CheckIcon,
  GlobeIcon,
  LockIcon,
  TextCursorIcon,
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
import { useChatId } from "./chat-provider";

export function AiChatHeader() {
  const chatId = useChatId((s) => s.chatId);

  const chat = useQuery(api.chats.queries.getChat, {
    chatId,
  });

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

  const [isEditing, setIsEditing] = useState(false);
  const [chatTitle, setChatTitle] = useState(chat.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateChatTitle = useMutation(api.chats.mutations.updateChatTitle);

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

  const isPrivate = chat.visibility === "private";

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

      <Activity mode={isEditing ? "hidden" : "visible"}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={handleEdit} size="icon-sm" variant="ghost">
              <TextCursorIcon />
              <span className="sr-only">Edit</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("rename-chat")}</TooltipContent>
        </Tooltip>
      </Activity>
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
