import { expect, test, type WebSocketRoute } from "@playwright/test";
import { Effect } from "effect";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";

const MATERIAL_PATH =
  "/en/subjects/mathematics/function-composition-inverse-function/function-concept";
const MATERIAL_CONTEXT =
  "merdeka~class-11-mathematics-function-composition-inverse-function";
const CONTEXTUAL_MATERIAL_HREF = `${MATERIAL_PATH}?ctx=${MATERIAL_CONTEXT}`;
const CONVEX_SOCKET_PATTERN = /\/api\/[^/]+\/sync/;
const MATERIAL_TITLE_PATTERN = /^Function Concept\b/;

/** Proves the rendered sidebar keeps verified placement without polluting SEO. */
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
          const connectSockets: (() => void)[] = [];
          let contextSubscriptions = 0;
          yield* Effect.promise(() =>
            page.routeWebSocket(CONVEX_SOCKET_PATTERN, (socket) => {
              const buffered: Parameters<WebSocketRoute["send"]>[0][] = [];
              socket.onMessage((message) => buffered.push(message));
              connectSockets.push(() => {
                const server = socket.connectToServer();
                const forward = (
                  message: Parameters<WebSocketRoute["send"]>[0]
                ) => {
                  const text = message.toString();
                  contextSubscriptions +=
                    text.split('"udfPath":"contentRelease/program:context"')
                      .length - 1;
                  server.send(message);
                };
                for (const message of buffered) {
                  forward(message);
                }
                socket.onMessage(forward);
              });
            })
          );
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* seedDeniedAnalyticsConsent(page);
              const response = yield* Effect.promise(() =>
                page.goto(CONTEXTUAL_MATERIAL_HREF, {
                  waitUntil: "domcontentloaded",
                })
              );
              yield* Effect.sync(() => expect(response?.status()).toBe(200));

              // The full lesson must be readable before any realtime response.
              const title = page.getByRole("heading", { level: 1 });
              const opening = page.getByRole("heading", { level: 2 }).first();
              yield* Effect.promise(() => expect(title).toBeVisible());
              yield* Effect.promise(() => expect(opening).toBeVisible());
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
                expect.poll(() => connectSockets.length).toBeGreaterThan(0)
              );
              yield* Effect.sync(() => {
                for (const connect of connectSockets) {
                  connect();
                }
              });

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
              yield* Effect.promise(() =>
                expect(header).toHaveAttribute("href", CONTEXTUAL_MATERIAL_HREF)
              );
              yield* Effect.sync(() => expect(contextSubscriptions).toBe(1));
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
