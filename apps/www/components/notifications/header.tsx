"use client";

import { useMutation } from "@confect/react";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, type Option } from "effect";
import { useTranslations } from "use-intl";
import {
  type InboxFirstPage,
  useInbox,
} from "@/components/notifications/inbox.client";
import { markAllReadInLists } from "@/components/notifications/mutation.client";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { reportClientException } from "@/lib/analytics/client";

/**
 * The sticky breadcrumb header of the inbox, as every account page has it, with the
 * inbox's one action at its end while the inbox has rows: its icon and its words, or
 * on a phone its icon alone, named for assistive technology, so the header stays one
 * row. The action marks every loaded row read at once, stays inert until the live
 * inbox takes a change, and a refusal by the server rolls the change back and shows
 * the shared error toast.
 */
export function NotificationsHeader({
  first,
}: {
  first: Option.Option<InboxFirstPage>;
}) {
  const t = useTranslations("Notifications");
  const { ready, rows } = useInbox(first);
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
        action:
          rows.length > 0 ? (
            <Button
              inert={!ready}
              onClick={markAllRead}
              size="sm"
              variant="ghost"
            >
              <HugeIcons icon={CheckmarkCircle02Icon} />
              <span className="max-sm:sr-only">{t("mark-all-read")}</span>
            </Button>
          ) : undefined,
        homeHref: "/home",
        homeLabel: tCommon("home"),
        items: [{ label: t("title") }],
        menuLabel: tCommon("more"),
        title: t("title"),
      }}
    />
  );
}
