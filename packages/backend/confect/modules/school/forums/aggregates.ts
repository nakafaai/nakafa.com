import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "@repo/backend/confect/modules/integrations/convexComponents";

export const forumPostsBySequence = new TableAggregate(
  components.forumPostsBySequence,
  {
    namespace: (post) => post.forumId,
    sortKey: (post) => post.sequence,
  }
);

export const forumPostsByAuthorSequence = new TableAggregate(
  components.forumPostsByAuthorSequence,
  {
    namespace: (post) => [post.forumId, post.createdBy],
    sortKey: (post) => post.sequence,
  }
);
