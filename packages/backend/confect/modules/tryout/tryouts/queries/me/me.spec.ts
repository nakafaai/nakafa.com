import { GroupSpec } from "@confect/core";
import { tryoutsQueriesMeAttemptGroup } from "./attempt.spec";
import { tryoutsQueriesMeHistoryGroup } from "./history.spec";
import { tryoutsQueriesMePartGroup } from "./part.spec";
import { tryoutsQueriesMeSessionGroup } from "./session.spec";
import { tryoutsQueriesMeSetViewGroup } from "./setView.spec";

const tryoutsQueriesMeGroup = GroupSpec.make("me")
  .addGroup(tryoutsQueriesMeAttemptGroup)
  .addGroup(tryoutsQueriesMePartGroup)
  .addGroup(tryoutsQueriesMeHistoryGroup)
  .addGroup(tryoutsQueriesMeSetViewGroup)
  .addGroup(tryoutsQueriesMeSessionGroup);

export { tryoutsQueriesMeGroup };
