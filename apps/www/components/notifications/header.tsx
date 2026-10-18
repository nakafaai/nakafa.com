"use client";

import { useMutation } from "@confect/react";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import { Button } from "@repo/design-system/components/ui/button";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { markAllReadInLists } from "@/components/notifications/mutation.client";
import { reportClientException } from "@/lib/analytics/client";

/**
 * The title of the inbox on the left and its one action on the right. The action
 * marks every loaded row read at once, and a refusal by the server rolls the change
 * back and shows the shared error toast.
 */
export function NotificationsHeader() {
  const t = useTranslations("Notifications");
  const readAll = useMutation(notifications.inbox.readAll).withOptimisticUpdate(
    markAllReadInLists
  );

  /** Marks every loaded row read, and tells the learner when the server refuses. */
  function markAllRead() {
    Effect.runPromise(
      Effect.tryPromise(() => readAll({})).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.matchEffect({
          onSuccess: () => Effect.void,
          onFailure: (error) =>
            reportClientException(error, {
              source: "components/notifications/header",
            }).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  toast.error({
                    title: "action-error.title",
                    description: "action-error.description",
                  });
                })
              )
            ),
        })
      )
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="font-semibold text-lg">{t("title")}</h1>
      <Button onClick={markAllRead} size="sm" variant="ghost">
        {t("mark-all-read")}
      </Button>
    </div>
  );
}
