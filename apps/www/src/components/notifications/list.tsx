import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Array as Arr, type Option } from "effect";
import { useTranslations } from "use-intl";
import {
  type InboxFirstPage,
  useInbox,
} from "@/components/notifications/inbox";
import { PushOffer } from "@/components/notifications/push";
import { NotificationRow } from "@/components/notifications/row";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { FeedEmpty, FeedNotice } from "@/components/user/feed";

/**
 * The rows of the inbox, newest first. The server's first page is on the screen before the
 * browser connects, and the next page loads as the end of the list comes into view. A failed
 * read shows above the rows the inbox holds and keeps them, and the rows stay inert until the
 * live inbox takes a change, so every change shows at once.
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
  return (
    <div className="flex flex-col">
      {failed && (
        <FeedNotice>
          <DataFailure onRetry={reloadPage} />
        </FeedNotice>
      )}
      {empty && <FeedEmpty>{t("empty")}</FeedEmpty>}
      <div className="flex flex-col" inert={!ready}>
        {Arr.map(rows, (notification) => (
          <NotificationRow key={notification.id} notification={notification} />
        ))}
        {loadMore && <Intersection onIntersect={loadMore} />}
      </div>
      <PushOffer />
    </div>
  );
}
