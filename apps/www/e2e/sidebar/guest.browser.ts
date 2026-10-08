import { expect, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/context";
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
          yield* seedAnalyticsConsent(page, "denied");
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
          // The panel's inner surface paints on desktop and the sheet's on
          // phones; the desktop wrapper itself takes no room beside the page.
          const footer = page
            .locator('[data-sidebar="sidebar"]:visible')
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
              page.getByRole("menuitem", {
                exact: true,
                name: "Deutsch (Deutschland)",
              })
            ).toBeVisible()
          );
        })
      )
    );
  });
}

test("the language menu opens the same route in the chosen language", async ({
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
        const response = yield* Effect.promise(() =>
          page.goto("/en/search", { waitUntil: "domcontentloaded" })
        );
        yield* Effect.sync(() => expect(response?.ok()).toBe(true));

        const languageButton = page
          .locator('[data-sidebar="sidebar"]:visible')
          .getByRole("button", { exact: true, name: "Language" });
        const german = page.getByRole("menuitem", {
          exact: true,
          name: "Deutsch (Deutschland)",
        });
        yield* activateUntilVisible(
          languageButton,
          german,
          readinessTimeoutMilliseconds
        );
        // The pick loads the request module on demand, asks the route-owned
        // endpoint for the localized href, and replaces the route with it.
        yield* Effect.promise(() => german.click());
        yield* Effect.promise(() =>
          expect(page).toHaveURL(new URL("/de/search", page.url()).toString(), {
            timeout: readinessTimeoutMilliseconds,
          })
        );
        yield* Effect.promise(() =>
          expect(page.locator("html")).toHaveAttribute("lang", "de")
        );
      })
    )
  );
});

test("provider failures land on one clean generic retry", async ({ page }) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
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
        const providerError = page.getByText(en.Auth["provider-error"], {
          exact: true,
        });
        yield* Effect.promise(() => expect(providerError).toBeVisible());
        yield* Effect.promise(() =>
          expect(providerError).toHaveAttribute("role", "alert")
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
        yield* seedAnalyticsConsent(page, "denied");
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

        // A middle click opens the link in a background tab, and the browser
        // reads the href when the auxclick's default action runs. The last
        // listener records that href and whether the app left the default
        // action alone, then cancels the tab: Playwright does not always
        // report a background tab, and its animated shader competes for a
        // small runner's CPU.
        const nativeClick = yield* Effect.promise(() =>
          loginLink.evaluateHandle((link) => {
            const observed: {
              cancelled: boolean | null;
              href: string | null;
            } = { cancelled: null, href: null };
            window.addEventListener(
              "auxclick",
              (event) => {
                observed.cancelled = event.defaultPrevented;
                observed.href = link.getAttribute("href");
                event.preventDefault();
              },
              { once: true }
            );
            return observed;
          })
        );
        yield* Effect.promise(() => loginLink.click({ button: "middle" }));
        const native = yield* Effect.promise(() => nativeClick.jsonValue());
        yield* Effect.sync(() =>
          expect(native).toStrictEqual({ cancelled: false, href: exactHref })
        );
        // The tab would load this exact URL, so a redirect must not pass.
        const nativeResponse = yield* Effect.promise(() =>
          page.request.get(new URL(exactHref, page.url()).toString(), {
            maxRedirects: 0,
          })
        );
        yield* Effect.sync(() => expect(nativeResponse.ok()).toBe(true));
        yield* Effect.promise(() =>
          expect(page).toHaveURL(new URL(intent, page.url()).toString())
        );

        yield* Effect.promise(() =>
          page.reload({ waitUntil: "domcontentloaded" })
        );
        yield* Effect.promise(() => expect(loginLink).toBeVisible());
        yield* Effect.promise(() => loginLink.dispatchEvent("contextmenu"));
        yield* Effect.promise(() =>
          expect(loginLink).toHaveAttribute("href", exactHref)
        );
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
        yield* seedAnalyticsConsent(page, "denied");
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
          name: "Start",
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

test("guest sidebar marks only the page the reader is on", async ({ page }) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
        yield* Effect.promise(() =>
          page.setViewportSize({ height: 900, width: 1440 })
        );
        const appSidebar = page.locator(
          '[data-side="left"] [data-sidebar="sidebar"]'
        );
        const currentLinks = appSidebar.locator('a[aria-current="page"]');
        const response = yield* Effect.promise(() =>
          page.goto("/en/quran", { waitUntil: "domcontentloaded" })
        );
        yield* Effect.sync(() => expect(response?.ok()).toBe(true));
        // The link to the page on screen is the only current one; the brand
        // link home never claims it.
        yield* Effect.promise(() =>
          expect(currentLinks).toHaveText([en.Holy.quran])
        );

        // A surah keeps the Quran section highlighted, but the index link is
        // not the page the reader is on; the outline's link to this surah is.
        yield* Effect.promise(() =>
          page.goto("/en/quran/2", { waitUntil: "domcontentloaded" })
        );
        yield* Effect.promise(() =>
          expect(
            appSidebar.getByRole("link", { exact: true, name: en.Holy.quran })
          ).toHaveAttribute("data-active", "true")
        );
        yield* Effect.promise(() => expect(currentLinks).toHaveCount(0));
        yield* Effect.promise(() =>
          expect(
            page.locator('[data-side="right"] a[href="/en/quran/2"]')
          ).toHaveAttribute("aria-current", "page")
        );
      })
    )
  );
});
