import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { insertTestPage } from "@repo/backend/test/content/page";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import { Effect } from "effect";

/** The signed legal Pages of every language, as the production release holds them. */
export const signedPages = Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  yield* Effect.promise(async () => {
    await insertRuntimeRelease(ctx, ["page"]);
    for (const locale of ACTIVE_APP_LOCALE_CODES) {
      await insertTestPage(ctx, locale, "privacy-policy", `privacy-${locale}`);
      await insertTestPage(ctx, locale, "terms-of-service", `terms-${locale}`);
    }
  });
});
