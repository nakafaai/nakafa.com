"use client";

import { Delete02Icon } from "@hugeicons/core-free-icons";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useConvex } from "convex/react";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { useDeleteChatMutation } from "@/components/ai/chat/mutation.client";
import { reportClientException } from "@/lib/analytics/client";
import { requireConvexOnline } from "@/lib/convex/online";
import { useViewer } from "@/lib/identity/client";

/** Owns destructive confirmation and routes away only after confirmed deletion. */
export function ChatDeletion({
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
  const convex = useConvex();
  /** Leave the current route and delete the owned chat. */
  const handleDelete = () => {
    if (!user || isPending) {
      return;
    }
    startTransition(async () =>
      Effect.runPromise(
        requireConvexOnline(convex).pipe(
          Effect.tap(() => Effect.sync(() => onOpenChange(false))),
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
            Effect.sync(() => router.replace(`/user/${user.appUser._id}/chat`))
          ),
          Effect.matchEffect({
            onSuccess: () => Effect.void,
            onFailure: () =>
              Effect.sync(() => {
                toast.error(actionErrorMessage);
              }),
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
