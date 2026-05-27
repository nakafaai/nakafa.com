import { GroupSpec } from "@confect/core";
import { tryoutsQueriesMeAttemptGroup } from "@repo/backend/confect/modules/tryout/tryouts/queries/me/attempt.spec";
import { tryoutsQueriesMeHistoryGroup } from "@repo/backend/confect/modules/tryout/tryouts/queries/me/history.spec";
import { tryoutsQueriesMePartGroup } from "@repo/backend/confect/modules/tryout/tryouts/queries/me/part.spec";
import { tryoutsQueriesMeSessionGroup } from "@repo/backend/confect/modules/tryout/tryouts/queries/me/session.spec";
import { tryoutsQueriesMeSetViewGroup } from "@repo/backend/confect/modules/tryout/tryouts/queries/me/setView.spec";

const tryoutsQueriesMeGroup = GroupSpec.make("me")
  .addGroup(tryoutsQueriesMeAttemptGroup)
  .addGroup(tryoutsQueriesMePartGroup)
  .addGroup(tryoutsQueriesMeHistoryGroup)
  .addGroup(tryoutsQueriesMeSetViewGroup)
  .addGroup(tryoutsQueriesMeSessionGroup);

export { tryoutsQueriesMeGroup };
