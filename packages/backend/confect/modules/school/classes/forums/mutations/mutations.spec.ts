import { GroupSpec } from "@confect/core";
import { classesForumsMutationsForumsGroup } from "./forums.spec";
import { classesForumsMutationsPostsGroup } from "./posts.spec";
import { classesForumsMutationsReactionsGroup } from "./reactions.spec";
import { classesForumsMutationsReadStateGroup } from "./readState.spec";
import { classesForumsMutationsUploadsGroup } from "./uploads.spec";

const classesForumsMutationsGroup = GroupSpec.make("mutations")
  .addGroup(classesForumsMutationsForumsGroup)
  .addGroup(classesForumsMutationsPostsGroup)
  .addGroup(classesForumsMutationsReactionsGroup)
  .addGroup(classesForumsMutationsReadStateGroup)
  .addGroup(classesForumsMutationsUploadsGroup);

export { classesForumsMutationsGroup };
