import { expect, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { activateUntilVisible } from "@/e2e/support/input";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/**
 * The language menu replaces the route with the route of the chosen locale.
 * The server decides that address, the router takes it in place, and the
 * window keeps its marker, so the switch is a client navigation.
 */
test("the language menu replaces the route in the chosen locale in place", async ({
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
        yield* Effect.promise(() =>
          page.goto("/en/search", { waitUntil: "domcontentloaded" })
        );
        yield* Effect.promise(() =>
          page.evaluate(() => {
            Object.assign(window, { navigationMarker: "same-document" });
          })
        );

        const languageButton = page
          .locator('[data-sidebar="sidebar"]:visible')
          .getByRole("button", { exact: true, name: "Language" });
        const german = page.getByRole("menuitem", {
          exact: true,
          name: "Deutsch",
        });
        yield* activateUntilVisible(
          languageButton,
          german,
          readinessTimeoutMilliseconds
        );
        yield* Effect.promise(() => german.click());
        yield* Effect.promise(() => page.waitForURL("**/de/search"));
        yield* Effect.sync(() =>
          expect(new URL(page.url()).pathname).toBe("/de/search")
        );

        const marker = yield* Effect.promise(() =>
          page.evaluate(() => Reflect.get(window, "navigationMarker"))
        );
        yield* Effect.sync(() => expect(marker).toBe("same-document"));
        yield* Effect.promise(() =>
          expect(page.locator("html")).toHaveAttribute("lang", "de")
        );
      })
    )
  );
});

/**
 * Every language of the menu shows the flag of its own country, so no two
 * options draw the same mark and a reader finds their language at a glance.
 */
test("the language menu shows each language with its own country's flag", async ({
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
        yield* Effect.promise(() =>
          page.goto("/en/search", { waitUntil: "domcontentloaded" })
        );
        const languageButton = page
          .locator('[data-sidebar="sidebar"]:visible')
          .getByRole("button", { exact: true, name: "Language" });
        const english = page.getByRole("menuitem", {
          exact: true,
          name: "English",
        });
        yield* activateUntilVisible(
          languageButton,
          english,
          readinessTimeoutMilliseconds
        );
        const marks = yield* Effect.promise(() =>
          page
            .getByRole("menuitem")
            .evaluateAll((items) =>
              items.map((item) => item.querySelector("svg")?.outerHTML ?? "")
            )
        );
        yield* Effect.sync(() => {
          expect(marks.length).toBeGreaterThan(1);
          expect(Arr.dedupe(marks)).toHaveLength(marks.length);
        });
      })
    )
  );
});
