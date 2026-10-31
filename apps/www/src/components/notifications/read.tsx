import { useMutation } from "@confect/react";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import { useTranslations } from "use-intl";
import type { InboxScope } from "@/components/notifications/inbox";
import { markAllReadInLists } from "@/components/notifications/mutation";
import { reportClientException } from "@/lib/analytics/client";

/**
 * The inbox's one action: it marks every row of its scope read, the loaded ones at
 * once. It is in the header from the first paint
 * and final, so the header never changes while the inbox loads; with no unread row it
 * marks nothing.
 * Its icon and its words show, or on a phone its icon alone, named for assistive
 * technology, so a header stays one row. A press before the inbox loads still sends:
 * the server marks every unread row, and the inbox loads them read. A refusal by the
 * server rolls the change back and shows the shared error toast.
 */
export function MarkAllRead({ scope }: { scope: InboxScope }) {
  const t = useTranslations("Notifications");
  const readAll = useMutation(notifications.inbox.readAll).withOptimisticUpdate(
    markAllReadInLists
  );

  return (
    <Button
      onClick={() =>
        Effect.runPromise(
          Effect.tryPromise(() => readAll(scope)).pipe(
            Effect.flatMap(Effect.fromResult),
            Effect.catch((error) =>
              reportClientException(error, {
                source: "components/notifications/read",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() =>
                    toast.error({
                      description: "action-error.description",
                      title: "action-error.title",
                    })
                  )
                )
              )
            )
          )
        )
      }
      variant="ghost"
    >
      <HugeIcons icon={CheckmarkCircle02Icon} />
      <span className="max-sm:sr-only">{t("mark-all-read")}</span>
    </Button>
  );
}
