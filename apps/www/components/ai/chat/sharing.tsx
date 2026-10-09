"use client";

import {
  Copy01Icon,
  Globe02Icon,
  Link04Icon,
  SquareLock01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { ChatVisibility } from "@repo/backend/confect/chats/schema";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { getAppUrl } from "@repo/next-config/app";
import { cn } from "cn";
import { Array as Arr, Effect } from "effect";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { useUpdateChatVisibilityMutation } from "@/components/ai/chat/mutation.client";
import { reportClientException } from "@/lib/analytics/client";

/** Owns sharing state and visibility admission independently of title editing. */
export function ChatSharing({
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
  const handleUpdateVisibility = (visibility: ChatVisibility) => {
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
                source: "components/ai/chat/sharing",
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
        {Arr.map(["public", "private"] as const, (visibility) => {
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
