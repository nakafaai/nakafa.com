"use client";

import { Delete02Icon } from "@hugeicons/core-free-icons";
import type { ChatView } from "@repo/backend/confect/chats/view";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useConvex } from "convex/react";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useDeleteChatMutation } from "@/components/ai/chat/mutation.client";
import { useChatStore } from "@/components/ai/chat/store.client";
import { reportClientException } from "@/lib/analytics/client";
import { requireConvexOnline } from "@/lib/convex/online";
import { useViewer } from "@/lib/identity/client";
import { ownChatsHref } from "@/lib/profile/href";

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
  const user = useViewer((s) => s.account);
  const deleteChat = useDeleteChatMutation();
  const leaving = useChatStore((state) => state.leaving);
  const leave = useChatStore((state) => state.leave);
  const stay = useChatStore((state) => state.stay);
  const convex = useConvex();
  /**
   * Leave the current route and delete the owned chat. The press stops the page
   * reading the chat at once, and a second press while the chat is leaving does
   * nothing, so the chat is never deleted twice.
   */
  const handleDelete = () => {
    if (!user || leaving) {
      return;
    }
    const { username } = user.appUser;
    onOpenChange(false);
    leave();
    Effect.runFork(
      requireConvexOnline(convex).pipe(
        Effect.andThen(
          Effect.tryPromise(() => deleteChat({ chatId: chat._id })).pipe(
            Effect.flatMap(Effect.fromResult),
            Effect.tapError((error) =>
              reportClientException(error, {
                source: "components/ai/chat/deletion",
              })
            )
          )
        ),
        Effect.tap(() =>
          Effect.sync(() => router.replace(ownChatsHref(username)))
        ),
        Effect.matchEffect({
          onSuccess: () => Effect.void,
          onFailure: () =>
            Effect.sync(() => {
              stay();
              toast.error({
                description: "action-error.description",
                title: "action-error.title",
              });
            }),
        })
      )
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
