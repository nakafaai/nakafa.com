import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  syncAllCreditResetPeriods as commerceCredits_syncAllCreditResetPeriods,
  syncCreditResetPeriod as commerceCredits_syncCreditResetPeriod,
} from "@repo/backend/confect/modules/commerce/credits.service";
import { Effect, Layer } from "effect";

const credits_mutations_syncAllCreditResetPeriodsImpl = FunctionImpl.make(
  api,
  "credits.mutations",
  "syncAllCreditResetPeriods",
  (_args) => commerceCredits_syncAllCreditResetPeriods().pipe(Effect.orDie)
);

const credits_mutations_syncCreditResetPeriodImpl = FunctionImpl.make(
  api,
  "credits.mutations",
  "syncCreditResetPeriod",
  (args) => commerceCredits_syncCreditResetPeriod(args).pipe(Effect.orDie)
);

const creditsMutationsImpl = GroupImpl.make(api, "credits.mutations")
  .pipe(Layer.provide(credits_mutations_syncAllCreditResetPeriodsImpl))
  .pipe(Layer.provide(credits_mutations_syncCreditResetPeriodImpl));

const creditsImpl = GroupImpl.make(api, "credits").pipe(
  Layer.provide(creditsMutationsImpl)
);

export const creditsLayer = Layer.mergeAll(creditsImpl);
