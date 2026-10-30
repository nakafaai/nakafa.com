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
import { reportClientException } from "@/lib/analytics/client";

/**
 * The inbox's one action, while it has rows: it marks every loaded row read at
 * once, or only the rows of the school that `slug` names. Its icon and its words
 * show, or on a phone its icon alone, named for assistive technology, so a header
 * stays one row. It stays inert until the live inbox takes a change, and a refusal
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
  const { ready, rows } = useInbox(first, slug);
  const readAll = useMutation(notifications.inbox.readAll).withOptimisticUpdate(
    markAllReadInLists
  );

  if (rows.length === 0) {
    return null;
  }

  return (
    <Button
      inert={!ready}
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
      size="sm"
      variant="ghost"
    >
      <HugeIcons icon={CheckmarkCircle02Icon} />
      <span className="max-sm:sr-only">{t("mark-all-read")}</span>
    </Button>
  );
}
