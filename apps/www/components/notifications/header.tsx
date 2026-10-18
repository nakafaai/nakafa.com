"use client";

import { useMutation } from "@confect/react";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import { Button } from "@repo/design-system/components/ui/button";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { markAllReadInLists } from "@/components/notifications/mutation.client";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { reportClientException } from "@/lib/analytics/client";

/**
 * The sticky breadcrumb header of the inbox, as every account page has it, with the
 * inbox's one action at its end. The action marks every loaded row read at once, and
 * a refusal by the server rolls the change back and shows the shared error toast.
 */
export function NotificationsHeader() {
  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");
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
    <BreadcrumbHeader
      value={{
        action: (
          <Button onClick={markAllRead} size="sm" variant="ghost">
            {t("mark-all-read")}
          </Button>
        ),
        homeLabel: tCommon("home"),
        items: [{ label: t("title") }],
        menuLabel: tCommon("more"),
        title: t("title"),
      }}
    />
  );
}
