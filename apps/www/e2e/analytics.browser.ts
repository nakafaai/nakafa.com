import { expect, type Page, type Request, test } from "@playwright/test";
import { Effect } from "effect";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "@/e2e/support/browser-context";

interface CapturedIngest {
  readonly event: string;
  readonly properties: Record<string, unknown>;
  readonly uuid: unknown;
}

function readIngestBody(request: Request): CapturedIngest | null {
  let raw: unknown = null;
  try {
    raw = request.postDataJSON();
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const body = raw as {
    readonly batch?: readonly CapturedIngest[];
    readonly event?: unknown;
    readonly properties?: unknown;
    readonly uuid?: unknown;
  };
  if (typeof body.event === "string") {
    return {
      event: body.event,
      properties:
        typeof body.properties === "object" && body.properties !== null
          ? (body.properties as Record<string, unknown>)
          : {},
      uuid: body.uuid,
    };
  }
  const [first] = body.batch ?? [];
  return first ?? null;
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

test("baseline counts one cookieless pageview before consent", async ({
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
              yield* Effect.promise(() =>
                expect(
                  page.getByRole("button", { name: "Allow" })
                ).toBeVisible()
              );
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

test("grant upgrades to attributed pageviews without duplicates", async ({
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

              yield* Effect.promise(() =>
                page.getByRole("button", { name: "Allow" }).click()
              );
              yield* waitForPageviews(captured, 2);

              yield* Effect.promise(() =>
                page.evaluate(() => {
                  window.history.pushState({}, "", "/en/e2e-nav?x=1");
                })
              );
              yield* waitForPageviews(captured, 3);

              const views = pageviews(captured);
              expect(views).toHaveLength(3);
              expect(views[0]?.properties.$cookieless_mode).toBe(true);
              expect(views[1]?.properties.consent_decision).toBe("granted");
              expect(views[2]?.properties.$current_url).toContain("?x=1");
            })
          );
        })
    )
  );
});
