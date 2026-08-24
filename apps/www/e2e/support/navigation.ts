import { instant } from "@next/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

const HOMEPAGE_HEADING_PATTERN = /Learn until it clicks/i;
const QURAN_HEADING_PATTERN = /Al-Baqara/i;
const TRYOUT_TITLE_PATTERN = /Try out/i;
const CURRICULUM_HREF_PATTERN = /^\/en\/curriculum\/[^/]+\/[^/]+\/[^/.]+$/;
const ARTICLE_HREF_PATTERN = /^\/en\/articles\/[^/]+\/[^/.]+$/;
const MATERIAL_HREF_PATTERN = /^\/en\/subjects\/[^/]+\/[^/]+\/[^/.]+$/;

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

async function assertSuccessfulNavigation(
  page: Page,
  target: NavigationTarget
) {
  await expect(page).toHaveURL((url) => url.pathname === target.href);

  if (target.marker.kind === "title") {
    await expect(page).toHaveTitle(target.marker.text);
    return;
  }

  const heading = page.locator("h1");
  await expect(heading).toHaveCount(1);
  await expect(heading).toBeVisible();
  if (target.marker.text) {
    await expect(heading).toContainText(target.marker.text);
  }
}

async function findVisibleLink(page: Page, href: string): Promise<Locator> {
  const candidates = page.locator(`a[href="${href}"]`);
  const count = await candidates.count();

  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    if (await candidate.isVisible()) {
      return candidate;
    }
  }

  throw new Error(`No visible link to ${href} was found.`);
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

  const candidates = page.locator("a[href]");
  const count = await candidates.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    const href = await candidate.getAttribute("href");
    if (href && matches(href) && (await candidate.isVisible())) {
      return href;
    }
  }

  throw new Error(
    `No matching visible content link was found on ${sourceHref}.`
  );
}

export async function verifyHardAndClientNavigation(
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
      await assertSuccessfulNavigation(page, target);
    },
    { baseURL }
  );

  const sourceResponse = await page.goto(target.sourceHref, {
    waitUntil: "domcontentloaded",
  });
  expect(sourceResponse?.ok()).toBe(true);
  const link = await findVisibleLink(page, target.href);
  await link.scrollIntoViewIfNeeded();

  await instant(page, async () => {
    await link.click();
    await assertSuccessfulNavigation(page, target);
  });
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
