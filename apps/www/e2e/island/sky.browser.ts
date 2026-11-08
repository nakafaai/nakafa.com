import { expect, test } from "@playwright/test";
import { DateTime, Effect, Schema } from "effect";
import { drawnIsland, expectDrawnIsland } from "@/e2e/support/island";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { desktopViewport, touchViewport } from "@/e2e/support/viewport";
import { CurrentWeatherSummarySchema } from "@/lib/weather/schema";

/** The island page of the signed-in learner. */
const ISLAND_PATH = "/en/island";

/** The local hour the night scenes are drawn at. */
const NIGHT_HOUR = 22;

/**
 * A fixed-offset zone where it is about ten at night right now, so the island,
 * which follows its owner's zone, draws its night without a faked clock. IANA's
 * `Etc/GMT` zones count the offset with the opposite sign.
 */
function nightZone() {
  const hour = DateTime.getPartUtc(DateTime.nowUnsafe(), "hour");
  const ahead = (((NIGHT_HOUR - hour) % 24) + 24) % 24;
  const offset = ahead > 12 ? ahead - 24 : ahead;
  if (offset === 0) {
    return "Etc/GMT";
  }
  return offset > 0 ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`;
}

/** The weather route's answer for one weather-service icon, as its JSON body. */
function weatherAnswer(icon: string) {
  return Schema.encodeSync(Schema.fromJsonString(CurrentWeatherSummarySchema))({
    city: "Bandung",
    condition: "weather",
    country: "ID",
    icon,
    temperatureKelvin: 294,
  });
}

const SCENES = [
  {
    icon: "10n",
    name: "rainy night",
    sky: "night rain",
    viewport: desktopViewport,
  },
  {
    icon: "10n",
    name: "rainy night",
    sky: "night rain",
    viewport: touchViewport,
  },
  {
    icon: "01n",
    name: "clear night",
    sky: "night clear",
    viewport: desktopViewport,
  },
] as const;

for (const scene of SCENES) {
  test(`draws the island's ${scene.name} on the ${scene.viewport.name} screen`, async ({
    baseURL,
    browser,
  }, testInfo) => {
    expect(baseURL).toBeTruthy();
    const origin = baseURL ?? "";
    const context = await browser.newContext({
      baseURL: origin,
      colorScheme: "dark",
      hasTouch: scene.viewport.hasTouch,
      timezoneId: nightZone(),
      viewport: {
        height: scene.viewport.height,
        width: scene.viewport.width,
      },
    });
    await context.route("**/api/weather", (route) =>
      route.fulfill({
        body: weatherAnswer(scene.icon),
        contentType: "application/json",
        status: 200,
      })
    );
    await Effect.runPromise(signInLearner(context, origin));
    const page = await context.newPage();
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.promise(async () => {
          await page.goto(ISLAND_PATH);
          await expectDrawnIsland(page);
          await expect(drawnIsland(page)).toHaveAttribute(
            "data-sky",
            scene.sky
          );
        })
      )
    );
    await testInfo.attach(
      `island-${scene.name.replace(" ", "-")}-${scene.viewport.name}.png`,
      {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      }
    );
    await context.close();
  });
}
