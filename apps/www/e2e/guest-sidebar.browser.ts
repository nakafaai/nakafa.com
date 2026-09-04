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

          const loginLink = page.getByRole("link", {
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
              loginLink,
              readinessTimeoutMilliseconds
            );
          }

          yield* Effect.promise(() => expect(footer).toBeVisible());
          const sectionSeparator = footer.locator(
            '[data-slot="sidebar-menu-separator"]'
          );
          yield* Effect.promise(() => expect(sectionSeparator).toHaveCount(1));
          yield* Effect.promise(() =>
            expect(
              sectionSeparator.locator('[data-slot="separator"]')
            ).toBeVisible()
          );
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
          yield* Effect.promise(() => expect(loginLink).toBeVisible());
          yield* Effect.promise(() =>
            expect(loginLink).toHaveAttribute(
              "href",
              "/en/auth?redirect=%2Fen%2Fsearch"
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

test("provider failures land on one clean generic retry", async ({ page }) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedDeniedAnalyticsConsent(page);
        const intent = "/en/search?q=geometry#results";
        const providerLanding = `/en/auth/error?${new URLSearchParams({
          error: "access_denied",
          error_description: "provider diagnostic",
          intent,
        })}`;
        const response = yield* Effect.promise(() =>
          page.goto(providerLanding, { waitUntil: "domcontentloaded" })
        );
        yield* Effect.sync(() => expect(response?.ok()).toBe(true));

        const retryHref = `/en/auth?${new URLSearchParams({
          redirect: intent,
          error: "oauth",
        })}`;
        yield* Effect.promise(() =>
          expect(page).toHaveURL(new URL(retryHref, page.url()).toString())
        );
        yield* Effect.promise(() =>
          expect(page.getByRole("alert")).toBeVisible()
        );
        yield* Effect.sync(() => {
          expect(page.url()).not.toContain("access_denied");
          expect(page.url()).not.toContain("error_description");
          expect(page.url()).not.toContain("provider+diagnostic");
        });
      })
    )
  );
});

test("guest auth link preserves a dynamic query and hash for native actions", async ({
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedDeniedAnalyticsConsent(page);
        yield* Effect.promise(() =>
          page.setViewportSize({ height: 900, width: 1440 })
        );
        const pathnameAndQuery = "/en/curriculum/merdeka?view=all";
        const intent = `${pathnameAndQuery}#curriculum-overview`;
        const response = yield* Effect.promise(() =>
          page.goto(intent, { waitUntil: "domcontentloaded" })
        );
        yield* Effect.sync(() => expect(response?.ok()).toBe(true));

        const loginLink = page.getByRole("link", {
          exact: true,
          name: "Log in",
        });
        const fallbackHref = `/en/auth?redirect=${encodeURIComponent(
          pathnameAndQuery
        )}`;
        const exactHref = `/en/auth?redirect=${encodeURIComponent(intent)}`;
        yield* Effect.promise(() => expect(loginLink).toBeVisible());
        yield* Effect.promise(() =>
          expect(loginLink).toHaveAttribute("href", fallbackHref)
        );

        const nativeActions = [
          { button: 1, event: "pointerdown" },
          { button: 1, event: "auxclick" },
          { button: 2, event: "contextmenu" },
        ] as const;
        for (const action of nativeActions) {
          yield* Effect.promise(() =>
            loginLink.evaluate((link, href) => {
              link.setAttribute("href", href);
            }, fallbackHref)
          );
          yield* Effect.promise(() =>
            loginLink.dispatchEvent(action.event, { button: action.button })
          );
          yield* Effect.promise(() =>
            expect(loginLink).toHaveAttribute("href", exactHref)
          );
        }
      })
    )
  );
});

test("guest reaches authentication only when starting a public tryout", async ({
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedDeniedAnalyticsConsent(page);
        yield* Effect.promise(() =>
          page.setViewportSize({ height: 900, width: 1440 })
        );
        const response = yield* Effect.promise(() =>
          page.goto("/en/try-out", { waitUntil: "domcontentloaded" })
        );
        yield* Effect.sync(() => expect(response?.ok()).toBe(true));

        const countryHref = "/en/try-out/indonesia";
        const country = page.getByRole("button", {
          exact: true,
          name: "View exams Indonesia",
        });
        yield* Effect.promise(() => expect(country).toBeVisible());
        yield* Effect.promise(() =>
          expect(country).toHaveAttribute("href", countryHref)
        );
        yield* Effect.promise(() => country.click());
        yield* Effect.promise(() =>
          expect(page).toHaveURL(new URL(countryHref, page.url()).toString(), {
            timeout: readinessTimeoutMilliseconds,
          })
        );

        const examHref = `${countryHref}/snbt`;
        const exam = page.getByRole("button", {
          exact: true,
          name: "View options SNBT",
        });
        yield* Effect.promise(() => expect(exam).toBeVisible());
        yield* Effect.promise(() =>
          expect(exam).toHaveAttribute("href", examHref)
        );
        yield* Effect.promise(() => exam.click());
        yield* Effect.promise(() =>
          expect(page).toHaveURL(new URL(examHref, page.url()).toString(), {
            timeout: readinessTimeoutMilliseconds,
          })
        );

        const trackHref = `${examHref}/2027`;
        const track = page.getByRole("button", {
          exact: true,
          name: "View sets Year 2027",
        });
        yield* Effect.promise(() => expect(track).toBeVisible());
        yield* Effect.promise(() =>
          expect(track).toHaveAttribute("href", trackHref)
        );
        yield* Effect.promise(() => track.click());
        yield* Effect.promise(() =>
          expect(page).toHaveURL(new URL(trackHref, page.url()).toString(), {
            timeout: readinessTimeoutMilliseconds,
          })
        );

        const setHref = `${trackHref}/set-1`;
        const set = page.getByRole("link", { exact: true, name: "Set 1" });
        const setRow = page.getByRole("row").filter({ has: set });
        yield* Effect.promise(() =>
          expect(set).toBeVisible({ timeout: readinessTimeoutMilliseconds })
        );
        yield* Effect.promise(() => expect(setRow).toHaveCount(1));
        yield* Effect.promise(() =>
          expect(set).toHaveAttribute("href", setHref)
        );
        yield* Effect.promise(() => setRow.click());
        yield* Effect.promise(() =>
          expect(page).toHaveURL(new URL(setHref, page.url()).toString(), {
            timeout: readinessTimeoutMilliseconds,
          })
        );

        const start = page.getByRole("button", {
          exact: true,
          name: "Start free",
        });
        yield* Effect.promise(() =>
          expect(start).toBeEnabled({ timeout: readinessTimeoutMilliseconds })
        );
        yield* Effect.promise(() => start.click());
        const authHref = `/en/auth?redirect=${encodeURIComponent(setHref)}`;
        yield* Effect.promise(() =>
          expect(page).toHaveURL(new URL(authHref, page.url()).toString(), {
            timeout: readinessTimeoutMilliseconds,
          })
        );
        yield* Effect.promise(() =>
          expect(
            page.getByRole("button", {
              exact: true,
              name: "Continue with Google",
            })
          ).toBeVisible()
        );
      })
    )
  );
});
