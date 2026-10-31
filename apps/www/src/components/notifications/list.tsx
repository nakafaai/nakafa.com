import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { Array as Arr, Option, Schema } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  type InboxFirstPage,
  useInbox,
} from "@/components/notifications/inbox";
import { PushOffer } from "@/components/notifications/push";
import { NotificationRow } from "@/components/notifications/row";
import { InboxTopic, inTopic } from "@/components/notifications/topic";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { FeedEmpty, FeedNotice } from "@/components/user/feed";

/**
 * The rows of the inbox, newest first, in one card whose lines run edge to edge, under a row of topics that narrows
 * them. The server's first page is on the screen before the browser connects, and the next page loads as the end of
 * the list comes into view, under a topic too, so a topic with few rows keeps reading. A failed read shows above the
 * rows the inbox holds and keeps them, and the rows stay inert until the live inbox takes a change, so every change
 * shows at once.
 */
export function NotificationsList({
  first,
  slug,
}: {
  first: Option.Option<InboxFirstPage>;
  /** The one school whose rows show; every school's without it. */
  slug: TenantSlug | undefined;
}) {
  const t = useTranslations("Notifications");
  const { empty, failed, loadMore, ready, rows } = useInbox(first, slug);
  const [topic, setTopic] = useState<typeof InboxTopic.Type>("all");
  const shown = Arr.filter(rows, (row) => inTopic(row.changeType, topic));

  return (
    <div className="flex flex-col gap-4">
      {failed && (
        <FeedNotice>
          <DataFailure onRetry={reloadPage} />
        </FeedNotice>
      )}
      {empty && <FeedEmpty>{t("empty")}</FeedEmpty>}
      {empty ? null : <InboxTopics onChoose={setTopic} topic={topic} />}
      {!empty && Arr.isReadonlyArrayEmpty(shown) && (
        <FeedEmpty>{t("topic-empty")}</FeedEmpty>
      )}
      {Arr.isReadonlyArrayNonEmpty(shown) ? (
        <div
          className="bg-card ring-foreground/10 overflow-hidden rounded-xl shadow-xs ring-1 *:px-4 *:last:border-b-0"
          inert={!ready}
        >
          {Arr.map(shown, (notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
            />
          ))}
        </div>
      ) : null}
      {loadMore && <Intersection onIntersect={loadMore} />}
      <PushOffer />
    </div>
  );
}

/** The topics of the inbox: pressing the chosen one again keeps it, so one is always chosen. */
function InboxTopics({
  onChoose,
  topic,
}: {
  onChoose: (topic: typeof InboxTopic.Type) => void;
  topic: typeof InboxTopic.Type;
}) {
  const t = useTranslations("Notifications");

  return (
    <ToggleGroup
      aria-label={t("topic-label")}
      className="max-sm:w-full max-sm:auto-cols-auto"
      onValueChange={(value) =>
        Option.match(Schema.decodeUnknownOption(InboxTopic)(value), {
          onNone: () => undefined,
          onSome: onChoose,
        })
      }
      size="sm"
      value={topic}
      variant="outline"
    >
      <ToggleGroupItem value="all">{t("topic-all")}</ToggleGroupItem>
      <ToggleGroupItem value="exams">{t("topic-exams")}</ToggleGroupItem>
      <ToggleGroupItem value="classes">{t("topic-classes")}</ToggleGroupItem>
      <ToggleGroupItem value="forum">{t("topic-forum")}</ToggleGroupItem>
      <ToggleGroupItem value="school">{t("topic-school")}</ToggleGroupItem>
    </ToggleGroup>
  );
}
