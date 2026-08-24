import { instant } from "@next/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

const HOMEPAGE_HEADING_PATTERN = /Learn until it clicks/i;
const QURAN_HEADING_PATTERN = /Al-Baqara/i;
const TRYOUT_TITLE_PATTERN = /Try out/i;
const CURRICULUM_HREF_PATTERN = /^\/en\/curriculum\/[^/]+\/[^/]+\/[^/.]+$/;
const ARTICLE_HREF_PATTERN = /^\/en\/articles\/[^/]+\/[^/.]+$/;
const MATERIAL_HREF_PATTERN = /^\/en\/subjects\/[^/]+\/[^/]+\/[^/.]+$/;
const CLIENT_PREFETCH_SETTLE_MILLISECONDS = 1000;
const NAVIGATION_TIMEOUT_MILLISECONDS = 15_000;

type InstantMarker =
  | { readonly kind: "heading"; readonly text?: RegExp }
  | { readonly kind: "title"; readonly text: RegExp };

export interface NavigationTarget {
  readonly href: string;
  readonly marker: InstantMarker;
  readonly name: string;
  readonly sourceHref: string;
}

export interface NavigationCase {
  readonly name: string;
  readonly resolve: (page: Page) => Promise<NavigationTarget>;
}

async function assertSettledNavigation(page: Page, target: NavigationTarget) {
  await expect(page).toHaveURL((url) => url.pathname === target.href, {
    timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
  });

  if (target.marker.kind === "title") {
    await expect(page).toHaveTitle(target.marker.text, {
      timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
    });
    return;
  }

  const heading = target.marker.text
    ? page.locator("h1:visible").filter({ hasText: target.marker.text }).first()
    : page.locator("h1:visible").first();
  await expect(heading).toBeVisible({
    timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
  });
  if (target.marker.text) {
    await expect(heading).toContainText(target.marker.text);
  }
}

async function findVisibleLink(page: Page, href: string): Promise<Locator> {
  const link = page.locator(`a[href="${href}"]:visible`).first();
  if (href === "/en" && !(await link.isVisible())) {
    const sidebarTrigger = page
      .locator('[data-slot="sidebar-trigger"]:visible')
      .first();
    if (await sidebarTrigger.isVisible()) {
      await sidebarTrigger.click();
    }
  }

  await expect(link, `No visible link to ${href} was found.`).toBeVisible({
    timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
  });
  return link;
}

async function discoverLinkedHref(
  page: Page,
  sourceHref: string,
  matches: (href: string) => boolean
) {
  const response = await page.goto(sourceHref, {
    waitUntil: "domcontentloaded",
  });
  expect(response?.ok()).toBe(true);

  let resolvedHref: string | undefined;
  await expect
    .poll(
      async () => {
        const candidates = page.locator("a[href]");
        const count = await candidates.count();
        for (let index = 0; index < count; index += 1) {
          const candidate = candidates.nth(index);
          const href = await candidate.getAttribute("href");
          if (href && matches(href) && (await candidate.isVisible())) {
            resolvedHref = href;
            return true;
          }
        }
        return false;
      },
      {
        message: `No matching visible content link was found on ${sourceHref}.`,
        timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
      }
    )
    .toBe(true);

  if (!resolvedHref) {
    throw new Error(
      `No matching visible content link was found on ${sourceHref}.`
    );
  }
  return resolvedHref;
}

async function waitForDestination(page: Page, href: string) {
  await page.waitForURL((url) => url.pathname === href, {
    timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
  });
}

async function warmClientPrefetch(link: Locator) {
  await link.scrollIntoViewIfNeeded();
  await link.hover();
  await link.page().waitForTimeout(CLIENT_PREFETCH_SETTLE_MILLISECONDS);
}

async function navigateHard(
  page: Page,
  baseURL: string,
  target: NavigationTarget
) {
  await instant(
    page,
    async () => {
      const response = await page.goto(target.href, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.ok()).toBe(true);
      await waitForDestination(page, target.href);
    },
    { baseURL }
  );
  await assertSettledNavigation(page, target);
}

async function navigateClient(page: Page, target: NavigationTarget) {
  const sourceResponse = await page.goto(target.sourceHref, {
    waitUntil: "domcontentloaded",
  });
  expect(sourceResponse?.ok()).toBe(true);
  const link = await findVisibleLink(page, target.href);
  await warmClientPrefetch(link);

  await instant(page, async () => {
    await link.click();
    await waitForDestination(page, target.href);
  });
  await assertSettledNavigation(page, target);
}

export async function verifyHardAndClientNavigation(
  page: Page,
  baseURL: string,
  target: NavigationTarget
) {
  await navigateHard(page, baseURL, target);
  await navigateClient(page, target);
}

const staticNavigationCases: readonly NavigationCase[] = [
  {
    name: "homepage",
    resolve: () =>
      Promise.resolve({
        href: "/en",
        marker: { kind: "heading", text: HOMEPAGE_HEADING_PATTERN },
        name: "homepage",
        sourceHref: "/en/quran",
      }),
  },
  {
    name: "Quran",
    resolve: () =>
      Promise.resolve({
        href: "/id/quran/2",
        marker: { kind: "heading", text: QURAN_HEADING_PATTERN },
        name: "Quran",
        sourceHref: "/id/quran",
      }),
  },
  {
    name: "tryout",
    resolve: () =>
      Promise.resolve({
        href: "/en/try-out",
        marker: { kind: "title", text: TRYOUT_TITLE_PATTERN },
        name: "tryout",
        sourceHref: "/en",
      }),
  },
];

const curriculumCase: NavigationCase = {
  name: "curriculum",
  resolve: async (page) => {
    const sourceHref = "/en";
    const href = await discoverLinkedHref(page, sourceHref, (candidate) =>
      CURRICULUM_HREF_PATTERN.test(candidate)
    );
    return {
      href,
      marker: { kind: "heading" },
      name: "curriculum",
      sourceHref,
    };
  },
};

const articleCase: NavigationCase = {
  name: "article",
  resolve: async (page) => {
    const sourceHref = "/en/articles/politics";
    const href = await discoverLinkedHref(page, sourceHref, (candidate) =>
      ARTICLE_HREF_PATTERN.test(candidate)
    );
    return {
      href,
      marker: { kind: "heading" },
      name: "article",
      sourceHref,
    };
  },
};

const materialCase: NavigationCase = {
  name: "material",
  resolve: async (page) => {
    const sourceHref = "/en";
    const href = await discoverLinkedHref(page, sourceHref, (candidate) =>
      MATERIAL_HREF_PATTERN.test(candidate)
    );
    return {
      href,
      marker: { kind: "heading" },
      name: "material",
      sourceHref,
    };
  },
};

export const navigationCases = [
  ...staticNavigationCases,
  curriculumCase,
  articleCase,
  materialCase,
] as const;
