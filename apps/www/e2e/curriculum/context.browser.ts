import { expect, type Request, test } from "@playwright/test";
import { Deferred, Effect, MutableList } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withBrowserContext } from "@/e2e/support/context";
import { withObservedPageErrors } from "@/e2e/support/observe";

const MATERIAL_PATH =
  "/en/subjects/mathematics/function-composition-inverse-function/function-concept";
const MATERIAL_NODE =
  "class-11-mathematics-function-composition-inverse-function";
const MATERIAL_CONTEXT = `merdeka~${MATERIAL_NODE}`;
const CONTEXTUAL_MATERIAL_HREF = `${MATERIAL_PATH}?ctx=${MATERIAL_CONTEXT}`;
const MATERIAL_TITLE_PATTERN = /^Function Concept\b/;

/** The path of the Convex query that verifies a lesson's placement. */
const PLACEMENT_QUERY = "contentRelease/program:context";

/** Whether a request is the lesson's Convex query of the placement that its address names. */
const isPlacementRead = (request: Request) => {
  const body = request.postData() ?? "";
  return (
    request.method() === "POST" &&
    body.includes(`"${PLACEMENT_QUERY}"`) &&
    body.includes(MATERIAL_NODE)
  );
};

/**
 * Proves the lesson keeps its verified curriculum placement without polluting
 * SEO. The static lesson is readable before the placement arrives, the browser
 * asks Convex for it once, with no server function and without first missing a
 * static answer that no build writes, and the lesson's own link then carries it
 * while the title and the first section stay where they were.
 */
test("material sidebar preserves verified curriculum context", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        serviceWorkers: "block",
        viewport: { height: 900, width: 1440 },
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          const reads = MutableList.make<string>();
          const missedAnswers = MutableList.make<string>();
          const serverFunctions = MutableList.make<string>();
          page.on("request", (request) => {
            if (new URL(request.url()).pathname.startsWith("/_serverFn/")) {
              MutableList.append(serverFunctions, request.url());
            }
          });
          page.on("response", (response) => {
            if (
              response.url().includes("/_data/") &&
              response.status() === 404
            ) {
              MutableList.append(missedAnswers, response.url());
            }
          });
          const released = yield* Deferred.make<void>();
          const services = yield* Effect.context<never>();
          // The placement waits until the lesson has been read, as it would on
          // a slow connection, so nothing it changes can move the lesson first.
          yield* Effect.promise(() =>
            page.route(
              (url) => url.pathname === "/api/query",
              (route) => {
                if (!isPlacementRead(route.request())) {
                  return route.continue();
                }
                MutableList.append(reads, route.request().url());
                return Effect.runPromiseWith(services)(
                  Deferred.await(released).pipe(
                    Effect.andThen(() => Effect.promise(() => route.continue()))
                  )
                );
              }
            )
          );
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* seedAnalyticsConsent(page, "denied");
              const response = yield* Effect.promise(() =>
                page.goto(CONTEXTUAL_MATERIAL_HREF, {
                  waitUntil: "domcontentloaded",
                })
              );
              yield* Effect.sync(() => expect(response?.status()).toBe(200));

              // The full lesson must be readable before its placement arrives.
              const title = page.getByRole("heading", { level: 1 });
              const opening = page.getByRole("heading", { level: 2 }).first();
              yield* Effect.promise(() => expect(title).toBeVisible());
              yield* Effect.promise(() => expect(opening).toBeVisible());
              yield* Effect.promise(() =>
                expect(
                  page
                    .getByRole("navigation", {
                      name: "Breadcrumb",
                      exact: true,
                    })
                    .getByRole("link", { name: "Home", exact: true })
                ).toBeVisible()
              );
              yield* Effect.promise(() =>
                page.evaluate(() => document.fonts.ready.then(() => undefined))
              );
              const titleBefore = yield* Effect.promise(() =>
                title.boundingBox()
              );
              const openingBefore = yield* Effect.promise(() =>
                opening.boundingBox()
              );
              yield* Effect.promise(() =>
                expect.poll(() => reads.length).toBeGreaterThan(0)
              );
              yield* Deferred.succeed(released, undefined);

              const canonical = page.locator('link[rel="canonical"]');
              yield* Effect.promise(() => expect(canonical).toHaveCount(1));
              yield* Effect.promise(() =>
                expect(canonical).toHaveAttribute(
                  "href",
                  `https://nakafa.com${MATERIAL_PATH}`
                )
              );

              const header = page
                .locator("aside")
                .getByRole("link", { name: MATERIAL_TITLE_PATTERN });
              yield* Effect.promise(() => expect(header).toHaveCount(1));
              // The router writes the hint's tilde as %7E, which decodes to the same hint.
              yield* Effect.promise(() =>
                expect
                  .poll(async () => {
                    const target = new URL(
                      (await header.getAttribute("href")) ?? "",
                      page.url()
                    );
                    return [target.pathname, target.searchParams.get("ctx")];
                  })
                  .toStrictEqual([MATERIAL_PATH, MATERIAL_CONTEXT])
              );
              yield* Effect.sync(() => {
                expect(reads.length).toBe(1);
                expect(MutableList.toArray(missedAnswers)).toEqual([]);
                expect(MutableList.toArray(serverFunctions)).toEqual([]);
              });
              const titleAfter = yield* Effect.promise(() =>
                title.boundingBox()
              );
              const openingAfter = yield* Effect.promise(() =>
                opening.boundingBox()
              );
              yield* Effect.sync(() => {
                expect(titleAfter).toEqual(titleBefore);
                expect(openingAfter).toEqual(openingBefore);
              });
            })
          );
        })
    )
  );
});
