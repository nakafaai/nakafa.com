import { expect, test } from "@playwright/test";
import { Array as Arr, Effect, MutableList } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withBrowserContext } from "@/e2e/support/context";
import { withObservedPageErrors } from "@/e2e/support/observe";

const MATERIAL_PATH =
  "/en/subjects/mathematics/function-composition-inverse-function/function-concept";
const MATERIAL_CONTEXT =
  "merdeka~class-11-mathematics-function-composition-inverse-function";
const CONTEXTUAL_MATERIAL_HREF = `${MATERIAL_PATH}?ctx=${MATERIAL_CONTEXT}`;
const MATERIAL_TITLE_PATTERN = /^Function Concept\b/u;
const CLASS_PATH = "/curriculum/merdeka/class-11";

/**
 * Proves the lesson keeps its curriculum place without polluting SEO. The place
 * is in the static page, so its path stands before any page script runs, the browser
 * asks Convex for nothing and calls no server function, and hydrating moves nothing
 * while the lesson's own link takes the place too.
 */
test("a lesson shows its curriculum path from its static page, with no read", async ({
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
            const { pathname } = new URL(request.url());
            if (pathname.startsWith("/_serverFn/")) {
              MutableList.append(serverFunctions, request.url());
            }
            if (pathname === "/api/query") {
              MutableList.append(reads, request.postData() ?? "");
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
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* seedAnalyticsConsent(page, "denied");
              // With no script the page is what the first paint draws.
              yield* Effect.promise(() =>
                page.route("**/*.js", (route) => route.abort())
              );
              const response = yield* Effect.promise(() =>
                page.goto(CONTEXTUAL_MATERIAL_HREF, {
                  waitUntil: "domcontentloaded",
                })
              );
              yield* Effect.sync(() => expect(response?.status()).toBe(200));
              const path = page.getByRole("navigation", {
                name: "Breadcrumb",
                exact: true,
              });
              const classLink = path.locator(`a[href$="${CLASS_PATH}"]`);
              yield* Effect.promise(() => expect(classLink).toBeVisible());
              const title = page.getByRole("heading", { level: 1 });
              const titleBefore = yield* Effect.promise(() =>
                title.boundingBox()
              );

              yield* Effect.promise(() => page.unroute("**/*.js"));
              yield* Effect.promise(() =>
                page.goto(CONTEXTUAL_MATERIAL_HREF, { waitUntil: "load" })
              );
              yield* Effect.promise(() => expect(classLink).toBeVisible());

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
              const titleAfter = yield* Effect.promise(() =>
                title.boundingBox()
              );
              yield* Effect.sync(() => {
                expect(
                  Arr.filter(MutableList.toArray(reads), (body) =>
                    body.includes("contentRelease/program")
                  )
                ).toEqual([]);
                expect(MutableList.toArray(missedAnswers)).toEqual([]);
                expect(MutableList.toArray(serverFunctions)).toEqual([]);
                expect(titleAfter).toEqual(titleBefore);
              });
            })
          );
        })
    )
  );
});
