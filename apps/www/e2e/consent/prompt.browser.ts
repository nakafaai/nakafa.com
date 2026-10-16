import { expect, test } from "@playwright/test";
import {
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  createAnonymousAnalyticsConsent,
  encodeAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import { Effect, MutableList } from "effect";
import {
  compactContext,
  expectPromptRendered,
  observeHydrationErrors,
  PROMPT_DESCRIPTION,
  seedAnalyticsConsent,
  seedRawStorage,
  stopAppCode,
} from "@/e2e/support/consent";
import { withBrowserContext } from "@/e2e/support/context";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { NEXT_CHUNK_PATH } from "@/e2e/support/route";

/** An earlier notice that a browser may still hold a choice for. */
const OLDER_NOTICE_VERSION = "privacy-2026-08-21";

test("the usage data prompt is in the server HTML, paints before app code, and stays after hydration", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.promise(async () => {
          const page = await context.newPage();
          const hydrationErrors = observeHydrationErrors(page);
          await stopAppCode(page);
          const response = await page.goto(pinnedRoutes.material.en, {
            waitUntil: "domcontentloaded",
          });

          expect(await response?.text()).toContain(PROMPT_DESCRIPTION);
          await expect(page.getByText(PROMPT_DESCRIPTION)).toBeVisible();

          await page.unroute(NEXT_CHUNK_PATH);
          await page.reload({ waitUntil: "load" });

          await expect(page.getByText(PROMPT_DESCRIPTION)).toBeVisible();
          expect(MutableList.toArray(hydrationErrors)).toEqual([]);
        })
    )
  );
});

test("a visitor who already decided gets no prompt before the page hydrates", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          const hydrationErrors = observeHydrationErrors(page);
          yield* seedAnalyticsConsent(page, "granted");
          yield* Effect.promise(() => stopAppCode(page));
          const response = yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          expect(yield* Effect.promise(async () => response?.text())).toContain(
            PROMPT_DESCRIPTION
          );
          yield* Effect.promise(() => expectPromptRendered(page));
          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );

          yield* Effect.promise(() => page.unroute(NEXT_CHUNK_PATH));
          yield* Effect.promise(() => page.reload({ waitUntil: "load" }));

          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );
          expect(MutableList.toArray(hydrationErrors)).toEqual([]);
        })
    )
  );
});

test("a visitor who denied under an older notice gets no prompt before the page hydrates", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          // A denial stays a decision under any notice, as the store reads it.
          const older = yield* encodeAnonymousAnalyticsConsent({
            ...createAnonymousAnalyticsConsent("denied", 1),
            noticeVersion: OLDER_NOTICE_VERSION,
          });
          yield* Effect.promise(() =>
            seedRawStorage(page, ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY, older)
          );
          yield* Effect.promise(() => stopAppCode(page));
          yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          yield* Effect.promise(() => expectPromptRendered(page));
          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );
        })
    )
  );
});

test("a decision made under an older notice keeps the prompt before the page hydrates", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          // The store writes this record with the same encoder, under an older notice.
          const older = yield* encodeAnonymousAnalyticsConsent({
            ...createAnonymousAnalyticsConsent("granted", 1),
            noticeVersion: OLDER_NOTICE_VERSION,
          });
          yield* Effect.promise(() =>
            seedRawStorage(page, ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY, older)
          );
          yield* Effect.promise(() => stopAppCode(page));
          yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeVisible()
          );
        })
    )
  );
});

test("a browser privacy signal hides the prompt before and after the page hydrates", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* Effect.promise(() =>
            page.addInitScript(() => {
              Object.defineProperty(navigator, "globalPrivacyControl", {
                configurable: true,
                get: () => true,
              });
            })
          );
          yield* Effect.promise(() => stopAppCode(page));
          yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          yield* Effect.promise(() => expectPromptRendered(page));
          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );

          yield* Effect.promise(() => page.unroute(NEXT_CHUNK_PATH));
          yield* Effect.promise(() => page.reload({ waitUntil: "load" }));

          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );
        })
    )
  );
});

test("a visitor with JavaScript off gets no prompt, because nothing runs to record a choice", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        ...compactContext,
        javaScriptEnabled: false,
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          yield* Effect.promise(() => expectPromptRendered(page));
          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );
        })
    )
  );
});
