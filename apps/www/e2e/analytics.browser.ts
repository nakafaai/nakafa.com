import { expect, type Page, type Request, test } from "@playwright/test";
import { Effect, Option, Schema } from "effect";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "@/e2e/support/browser-context";
import { seedGrantedAnalyticsConsent } from "@/e2e/support/consent";

const CapturedIngestSchema = Schema.Struct({
  event: Schema.String,
  properties: Schema.Record(Schema.String, Schema.Unknown),
  uuid: Schema.optional(Schema.Unknown),
});

type CapturedIngest = Schema.Schema.Type<typeof CapturedIngestSchema>;

const IngestBodySchema = Schema.Union([
  CapturedIngestSchema,
  Schema.Struct({ batch: Schema.Array(CapturedIngestSchema) }),
]);

function readIngestBody(request: Request): CapturedIngest | null {
  const raw: unknown = Effect.runSync(
    Effect.try({
      try: () => request.postDataJSON(),
      catch: () => null,
    })
  );
  return Option.getOrNull(
    Option.flatMap(Schema.decodeUnknownOption(IngestBodySchema)(raw), (body) =>
      "batch" in body ? Option.fromNullishOr(body.batch[0]) : Option.some(body)
    )
  );
}

const observeIngest = Effect.fn("NakafaE2E.observeIngest")(function* (
  page: Page
) {
  const captured: CapturedIngest[] = [];
  yield* Effect.promise(() =>
    page.route("**/_nakafa/**", (route) => {
      const ingest = readIngestBody(route.request());
      if (ingest) {
        captured.push(ingest);
      }
      return route.abort();
    })
  );
  return captured;
});

/** Counts distinct pageviews so transport retries cannot inflate the total. */
function pageviewCount(captured: CapturedIngest[]) {
  const uuids = new Set<unknown>();
  let count = 0;
  for (const entry of captured) {
    if (entry.event !== "$pageview") {
      continue;
    }
    if (entry.uuid === undefined || !uuids.has(entry.uuid)) {
      uuids.add(entry.uuid);
      count += 1;
    }
  }
  return count;
}

function pageviews(captured: CapturedIngest[]) {
  const seen = new Set<unknown>();
  return captured.filter((entry) => {
    if (entry.event !== "$pageview" || seen.has(entry.uuid)) {
      return false;
    }
    seen.add(entry.uuid);
    return true;
  });
}

const waitForPageviews = (captured: CapturedIngest[], count: number) =>
  Effect.promise(() =>
    expect.poll(() => pageviewCount(captured), { timeout: 15_000 }).toBe(count)
  );

const openConsentPreferences = Effect.fn("NakafaE2E.openConsentPreferences")(
  function* (page: Page) {
    yield* Effect.promise(() =>
      page.locator("footer").getByRole("button", { name: "Usage data" }).click()
    );
    yield* Effect.promise(() =>
      expect(page.getByRole("heading", { name: "Usage data" })).toBeVisible({
        timeout: 15_000,
      })
    );
  }
);

test("baseline counts one cookieless pageview without consent", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", serviceWorkers: "block" },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              const captured = yield* observeIngest(page);
              const response = yield* Effect.promise(() =>
                page.goto("/en?e2e=baseline#frag", {
                  waitUntil: "domcontentloaded",
                })
              );
              yield* Effect.sync(() => expect(response?.ok()).toBe(true));
              yield* waitForPageviews(captured, 1);

              const [view] = pageviews(captured);
              expect(view?.properties.$cookieless_mode).toBe(true);
              expect(view?.properties.$current_url).toBe(`${baseURL}/en`);
              expect(view?.properties.$user_id).toBeUndefined();
              const keys = yield* Effect.promise(() =>
                page.evaluate(() => Object.keys(window.localStorage))
              );
              expect(
                keys.filter(
                  (key) =>
                    key.startsWith("ph_") || key.startsWith("__ph_opt_in_out")
                )
              ).toEqual([]);
            })
          );
        })
    )
  );
});

test("granted consent upgrades to attributed pageviews", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", serviceWorkers: "block" },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* seedGrantedAnalyticsConsent(page);
              const captured = yield* observeIngest(page);
              const response = yield* Effect.promise(() =>
                page.goto("/en", { waitUntil: "domcontentloaded" })
              );
              yield* Effect.sync(() => expect(response?.ok()).toBe(true));
              yield* waitForPageviews(captured, 1);

              yield* Effect.promise(() =>
                page.evaluate(() => {
                  window.history.pushState({}, "", "/en/e2e-nav?x=1");
                })
              );
              yield* waitForPageviews(captured, 2);

              const views = pageviews(captured);
              expect(views).toHaveLength(2);
              expect(views[0]?.properties.consent_decision).toBe("granted");
              expect(views[1]?.properties.$current_url).toContain("?x=1");
            })
          );
        })
    )
  );
});

test("grant keeps exact counts and attributes the next view", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", serviceWorkers: "block" },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              const captured = yield* observeIngest(page);
              const response = yield* Effect.promise(() =>
                page.goto("/en", { waitUntil: "domcontentloaded" })
              );
              yield* Effect.sync(() => expect(response?.ok()).toBe(true));
              yield* waitForPageviews(captured, 1);

              yield* openConsentPreferences(page);
              yield* Effect.promise(() =>
                page
                  .getByRole("dialog")
                  .getByRole("button", { name: "Allow" })
                  .click()
              );
              yield* Effect.promise(() =>
                expect(
                  page.getByRole("heading", { name: "Usage data" })
                ).toBeHidden({ timeout: 15_000 })
              );
              expect(pageviewCount(captured)).toBe(1);

              yield* Effect.promise(() =>
                page.evaluate(() => {
                  window.history.pushState({}, "", "/en/e2e-nav?x=1");
                })
              );
              yield* waitForPageviews(captured, 2);

              const views = pageviews(captured);
              expect(views).toHaveLength(2);
              expect(views[0]?.properties.$cookieless_mode).toBe(true);
              expect(views[1]?.properties.consent_decision).toBe("granted");
              expect(views[1]?.properties.$current_url).toContain("?x=1");
            })
          );
        })
    )
  );
});
