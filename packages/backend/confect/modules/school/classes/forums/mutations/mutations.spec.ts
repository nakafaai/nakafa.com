import { GroupSpec } from "@confect/core";
import { classesForumsMutationsForumsGroup } from "@repo/backend/confect/modules/school/classes/forums/mutations/forums.spec";
import { classesForumsMutationsPostsGroup } from "@repo/backend/confect/modules/school/classes/forums/mutations/posts.spec";
import { classesForumsMutationsReactionsGroup } from "@repo/backend/confect/modules/school/classes/forums/mutations/reactions.spec";
import { classesForumsMutationsReadStateGroup } from "@repo/backend/confect/modules/school/classes/forums/mutations/readState.spec";
import { classesForumsMutationsUploadsGroup } from "@repo/backend/confect/modules/school/classes/forums/mutations/uploads.spec";

const classesForumsMutationsGroup = GroupSpec.make("mutations")
  .addGroup(classesForumsMutationsForumsGroup)
  .addGroup(classesForumsMutationsPostsGroup)
  .addGroup(classesForumsMutationsReactionsGroup)
  .addGroup(classesForumsMutationsReadStateGroup)
  .addGroup(classesForumsMutationsUploadsGroup);

export { classesForumsMutationsGroup };
