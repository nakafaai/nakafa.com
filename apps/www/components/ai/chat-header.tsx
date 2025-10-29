import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { Input } from "@repo/design-system/components/ui/input";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { CheckIcon, Edit2Icon, XIcon } from "lucide-react";
import {
  Activity,
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
  return (
    <Header className="py-3">
      <Skeleton className="h-6 w-1/4" />

      <HeaderGroup>
        <Skeleton className="size-6" />
      </HeaderGroup>
    </Header>
  );
}

function AiChatHeaderContent({ chat }: { chat: Doc<"chats"> }) {
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
        <h1 className="max-w-xs truncate px-2 font-medium">{chat.title}</h1>
      </Activity>

      <Activity mode={isEditing ? "visible" : "hidden"}>
        <div className="flex items-center gap-2">
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
        </div>
      </Activity>

      <Activity mode={isEditing ? "hidden" : "visible"}>
        <Button onClick={handleEdit} size="icon-sm" variant="ghost">
          <Edit2Icon />
          <span className="sr-only">Edit</span>
        </Button>
      </Activity>
    </Header>
  );
}

function Header({
  className,
  children,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <header className="z-1 mx-auto mt-2 grid w-full max-w-3xl shrink-0">
      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-md border bg-card p-2 shadow-xs",
          className
        )}
      >
        {children}
      </div>
    </header>
  );
}

function HeaderGroup({
  className,
  children,
}: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("flex items-center", className)}>{children}</div>;
}
