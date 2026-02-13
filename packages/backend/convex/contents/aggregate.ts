import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type {
  ContentId,
  ContentType,
} from "@repo/backend/convex/lib/validators/contents";

/**
 * Aggregate for real-time content popularity tracking.
 * Enables O(log n) lookups for trending content and audio generation priority.
 *
 * Design:
 * - Namespace: locale (separate data structure per locale for performance)
 * - Key: [contentType, contentId] (identifies unique content)
 * - Sum: viewCount (total views for priority calculation)
 */
export const contentPopularity = new TableAggregate<{
  Namespace: string;
  Key: [ContentType, ContentId];
  DataModel: DataModel;
  TableName: "contentViews";
}>(components.contentPopularity, {
  namespace: (doc) => doc.locale,
  sortKey: (doc) => [doc.contentType, doc.contentId],
  sumValue: (doc) => doc.viewCount,
});
