import { expect, type Page, test } from "@playwright/test";
import { Effect, Schema } from "effect";
import { CHAT_PATH, runOnPage } from "@/e2e/support/chat";
import { seedAnalyticsConsent } from "@/e2e/support/consent";

/**
 * A phone on a slow connection: four times slower than this machine, 150 ms
 * away and 1.6 Mbps down, so the page arrives in parts and paints before all
 * of it is in.
 */
const slowPhone = Effect.fn("NakafaE2E.slowPhone")(function* (page: Page) {
  const cdp = yield* Effect.promise(() => page.context().newCDPSession(page));
  yield* Effect.promise(() =>
    cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
  );
  yield* Effect.promise(() => cdp.send("Network.enable"));
  yield* Effect.promise(() =>
    cdp.send("Network.emulateNetworkConditions", {
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      latency: 150,
      offline: false,
      uploadThroughput: (750 * 1024) / 8,
    })
  );
});

/** The size of each layout shift that the page recorded. */
const Shifts = Schema.Array(Schema.Finite);

/** Records every layout shift that no input caused, from the first paint on. */
function recordShifts() {
  const shifts: number[] = [];
  Object.assign(window, { nakafaShifts: shifts });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!("hadRecentInput" in entry && entry.hadRecentInput)) {
        shifts.push("value" in entry ? Number(entry.value) : 0);
      }
    }
  }).observe({ buffered: true, type: "layout-shift" });
}

for (const width of [390, 1440]) {
  test.describe(`the new chat at ${width}px`, () => {
    test.use({ viewport: { height: width < 768 ? 844 : 900, width } });

    test("moves nothing while it arrives on a slow phone", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, () =>
        Effect.gen(function* () {
          yield* seedAnalyticsConsent(page, "denied");
          yield* Effect.promise(() => page.addInitScript(recordShifts));
          yield* slowPhone(page);
          yield* Effect.promise(() =>
            page.goto(CHAT_PATH, { waitUntil: "load" })
          );
          yield* Effect.promise(() =>
            expect(
              page.getByRole("textbox", { name: "Ask Nina anything..." })
            ).toBeVisible()
          );
          // Late parts, such as the weather card, settle within seconds.
          yield* Effect.promise(() => page.waitForTimeout(4000));
          const shifts = yield* Effect.promise(() =>
            page.evaluate(() => Reflect.get(window, "nakafaShifts"))
          ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Shifts)));
          yield* Effect.sync(() => expect(shifts).toEqual([]));
        })
      );
    });
  });
}
