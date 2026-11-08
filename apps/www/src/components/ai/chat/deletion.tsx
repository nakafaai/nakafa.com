import {
  Delete02Icon,
  Globe02Icon,
  SquareLock01Icon,
} from "@hugeicons/core-free-icons";
import type { ChatView } from "@repo/backend/confect/chats/view";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  ResponsiveDialog,
  ResponsiveDialogSubject,
} from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useConvex } from "convex/react";
import { Effect } from "effect";
import { useTranslations } from "use-intl";
import { useDeleteChatMutation } from "@/components/ai/chat/mutation";
import { deleteOnPress } from "@/components/ai/chat/press";
import { useChatStore } from "@/components/ai/chat/store";
import { readChatTitle } from "@/components/ai/chat/title";
import { useAi } from "@/components/ai/context";
import { useViewer } from "@/lib/identity/client";
import { ownChatsTarget } from "@/lib/profile/href";

/**
 * The delete of the chat on screen, which routes away only after the delete is confirmed. The press hides the chat
 * from the page at once, because the server's delete makes every read of it fail, and the page must not show that
 * as an error. A refused delete shows the chat again.
 */
export function useChatPageDeletion(chat: ChatView, close: () => void) {
  const router = useRouter();
  const navigate = useNavigate();
  const user = useViewer((s) => s.account);
  const deleteChat = useDeleteChatMutation();
  const leaving = useChatStore((state) => state.leaving);
  const leave = useChatStore((state) => state.leave);
  const stay = useChatStore((state) => state.stay);
  const forgetChat = useAi((state) => state.forgetChat);
  const recallChat = useAi((state) => state.recallChat);
  const convex = useConvex();
  /** Leave the current route and delete the owned chat. */
  const handleDelete = () => {
    // A press while the chat is already leaving would send the delete twice.
    if (!user || leaving) {
      return;
    }
    const { username } = user.appUser;
    // The page the learner pressed Delete on. If they open another page while the
    // delete waits for the socket, the redirect after the delete leaves that page alone.
    const { pathname } = router.state.location;
    Effect.runFork(
      deleteOnPress({
        chatId: chat._id,
        close,
        convex,
        deleteChat,
        deleted: () => navigate({ ...ownChatsTarget(username), replace: true }),
        forget: () => forgetChat(chat._id),
        leave,
        recall: () => recallChat(chat._id),
        refused: () => {
          stay();
          toast.error({
            description: "action-error.description",
            title: "action-error.title",
          });
        },
        stillOnChat: () => router.state.location.pathname === pathname,
      })
    );
  };
  return handleDelete;
}

/**
 * Asks before a chat is deleted: the chat it takes away in the body, and Cancel beside Delete in the footer, on the
 * chat page and in the profile's list alike.
 */
export function ChatDeletionDialog({
  chat,
  onDelete,
  open,
  setOpen,
}: {
  chat: ChatView;
  onDelete: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("Ai");
  const common = useTranslations("Common");

  return (
    <ResponsiveDialog
      action={
        <Button onClick={onDelete} type="button" variant="destructive">
          <HugeIcons icon={Delete02Icon} />
          {common("delete")}
        </Button>
      }
      description={t("delete-chat-description")}
      open={open}
      setOpen={setOpen}
      title={t("delete-chat")}
    >
      <ResponsiveDialogSubject
        icon={chat.visibility === "private" ? SquareLock01Icon : Globe02Icon}
      >
        {readChatTitle(chat.title, t("new-chat"))}
      </ResponsiveDialogSubject>
    </ResponsiveDialog>
  );
}
