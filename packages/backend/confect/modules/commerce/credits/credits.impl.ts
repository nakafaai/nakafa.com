import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as commerce_credits from "@repo/backend/confect/modules/commerce/credits.service";
import { Layer } from "effect";

const credits_mutations_syncAllCreditResetPeriodsImpl = FunctionImpl.make(
  api,
  "credits.mutations",
  "syncAllCreditResetPeriods",
  (_args) => commerce_credits.syncAllCreditResetPeriods()
);

const credits_mutations_syncCreditResetPeriodImpl = FunctionImpl.make(
  api,
  "credits.mutations",
  "syncCreditResetPeriod",
  (args) => commerce_credits.syncCreditResetPeriod(args)
);

const creditsMutationsImpl = GroupImpl.make(api, "credits.mutations")
  .pipe(Layer.provide(credits_mutations_syncAllCreditResetPeriodsImpl))
  .pipe(Layer.provide(credits_mutations_syncCreditResetPeriodImpl));

const creditsImpl = GroupImpl.make(api, "credits").pipe(
  Layer.provide(creditsMutationsImpl)
);

export const creditsLayer = Layer.mergeAll(creditsImpl);
