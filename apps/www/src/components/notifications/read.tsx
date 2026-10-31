import { useMutation } from "@confect/react";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, type Option } from "effect";
import { useTranslations } from "use-intl";
import {
  type InboxFirstPage,
  useInbox,
} from "@/components/notifications/inbox";
import { markAllReadInLists } from "@/components/notifications/mutation";
import { hasUnread } from "@/components/notifications/state";
import { reportClientException } from "@/lib/analytics/client";

/**
 * The inbox's one action: it marks every row read, the loaded ones at once, or only
 * the rows of the school that `slug` names. It is in the header from the first paint
 * and stays in its place, so the header never changes while the inbox loads, and it
 * is disabled while no row waits to be read. Its icon and its words show, or on a phone
 * its icon alone, named for assistive technology, so a header stays one row. A refusal
 * by the server rolls the change back and shows the shared error toast.
 */
export function MarkAllRead({
  first,
  slug,
}: {
  first: Option.Option<InboxFirstPage>;
  /** The one school whose rows it marks; every school's without it. */
  slug: TenantSlug | undefined;
}) {
  const t = useTranslations("Notifications");
  const { rows } = useInbox(first, slug);
  const readAll = useMutation(notifications.inbox.readAll).withOptimisticUpdate(
    markAllReadInLists
  );

  return (
    <Button
      disabled={!hasUnread(rows)}
      onClick={() =>
        Effect.runPromise(
          Effect.tryPromise(() =>
            readAll(slug === undefined ? {} : { slug })
          ).pipe(
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
      variant="outline"
    >
      <HugeIcons icon={CheckmarkCircle02Icon} />
      <span className="max-sm:sr-only">{t("mark-all-read")}</span>
    </Button>
  );
}
