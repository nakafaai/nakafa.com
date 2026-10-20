import { Delete02Icon } from "@hugeicons/core-free-icons";
import type { ChatView } from "@repo/backend/confect/chats/view";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useCurrentLocale } from "@repo/internationalization/src/link";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useConvex } from "convex/react";
import { Effect } from "effect";
import { useTranslations } from "use-intl";
import { useDeleteChatMutation } from "@/components/ai/chat/mutation";
import { deleteOnPress } from "@/components/ai/chat/press";
import { useChatStore } from "@/components/ai/chat/store";
import { useViewer } from "@/lib/identity/client";
import { ownChatsTarget } from "@/lib/profile/href";

/**
 * Owns destructive confirmation and routes away only after confirmed deletion.
 * The press hides the chat from the page at once, because the server's delete
 * makes every read of it fail, and the page must not show that as an error.
 * A refused delete shows the chat again.
 */
export function ChatDeletion({
  chat,
  open,
  onOpenChange,
}: {
  chat: ChatView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Ai");
  const router = useRouter();
  const navigate = useNavigate();
  const locale = useCurrentLocale();
  const user = useViewer((s) => s.account);
  const deleteChat = useDeleteChatMutation();
  const leaving = useChatStore((state) => state.leaving);
  const leave = useChatStore((state) => state.leave);
  const stay = useChatStore((state) => state.stay);
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
        close: () => onOpenChange(false),
        convex,
        deleteChat,
        deleted: () =>
          navigate({ ...ownChatsTarget(username, locale), replace: true }),
        leave,
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
  return (
    <ResponsiveDialog
      description={t("delete-chat-description")}
      footer={
        <Button onClick={handleDelete} variant="destructive">
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
