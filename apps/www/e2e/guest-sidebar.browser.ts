import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";
import { activateUntilVisible } from "@/e2e/support/interaction";

const targetViewports = [
  { height: 844, name: "compact", width: 390 },
  { height: 900, name: "desktop", width: 1440 },
] as const;
const readinessTimeoutMilliseconds = 15_000;

for (const viewport of targetViewports) {
  test(`guest sidebar keeps account actions clear at ${viewport.name}`, async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          yield* seedDeniedAnalyticsConsent(page);
          yield* Effect.promise(() =>
            page.setViewportSize({
              height: viewport.height,
              width: viewport.width,
            })
          );
          const response = yield* Effect.promise(() =>
            page.goto("/en/search", { waitUntil: "domcontentloaded" })
          );
          yield* Effect.sync(() => expect(response?.ok()).toBe(true));

          const loginButton = page.getByRole("button", {
            exact: true,
            name: "Log in",
          });
          const footer = page
            .locator('[data-slot="sidebar"]:visible')
            .locator('[data-slot="sidebar-footer"]');

          if (viewport.name === "compact") {
            const sidebarTrigger = page
              .locator('[data-slot="sidebar-trigger"]:visible')
              .first();
            yield* activateUntilVisible(
              sidebarTrigger,
              loginButton,
              readinessTimeoutMilliseconds
            );
          }

          yield* Effect.promise(() => expect(footer).toBeVisible());
          yield* Effect.promise(() =>
            expect(
              footer.getByText("Continue learning", { exact: true })
            ).toBeVisible()
          );
          yield* Effect.promise(() =>
            expect(
              footer.getByText(
                "Log in to save progress in materials and tryouts.",
                { exact: true }
              )
            ).toBeVisible()
          );
          yield* Effect.promise(() =>
            expect(
              footer.getByRole("link", {
                exact: true,
                name: "See plans and pricing",
              })
            ).toBeVisible()
          );
          yield* Effect.promise(() =>
            expect(
              footer.getByRole("button", {
                exact: true,
                name: "Usage data",
              })
            ).toBeVisible()
          );
          yield* Effect.promise(() => expect(loginButton).toBeVisible());
          yield* Effect.promise(() =>
            expect(loginButton).toHaveAttribute(
              "href",
              "/en/auth?redirect=/search"
            )
          );
          const languageButton = footer.getByRole("button", {
            exact: true,
            name: "Language",
          });
          yield* Effect.promise(() => expect(languageButton).toBeVisible());
          yield* Effect.promise(() =>
            expect(
              languageButton.locator('[data-slot="language-menu-indicator"]')
            ).toBeVisible()
          );
          yield* Effect.promise(() => languageButton.hover());
          yield* Effect.promise(() =>
            expect(
              page.getByRole("menuitem", { exact: true, name: "Deutsch" })
            ).toBeVisible()
          );
        })
      )
    );
  });
}
