import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";

const readinessTimeoutMilliseconds = 15_000;
const quranIndexUrlPattern = /\/id\/quran$/;
const quranSurahUrlPattern = /\/id\/quran\/2$/;
const quranTranslationNoteHrefPattern = /^#.+-translation-note-\d+$/u;
const rawTranslationNotePattern = /\[\d+\]/u;

interface QuranLocaleContract {
  readonly hasEmbeddedTafsir: boolean;
  readonly hasTranslationNotes: boolean;
  readonly meaning: string;
  readonly translationNotesLabel: string;
}

type QuranLocaleContracts = {
  readonly [Locale in AppLocaleCode]: QuranLocaleContract & {
    readonly locale: Locale;
  };
};

const quranLocaleContracts = {
  de: {
    hasEmbeddedTafsir: false,
    hasTranslationNotes: false,
    locale: "de",
    meaning: "Die Kuh",
    translationNotesLabel: "Anmerkungen zur Übersetzung",
  },
  en: {
    hasEmbeddedTafsir: false,
    hasTranslationNotes: true,
    locale: "en",
    meaning: "The Cow",
    translationNotesLabel: "Translation notes",
  },
  id: {
    hasEmbeddedTafsir: true,
    hasTranslationNotes: true,
    locale: "id",
    meaning: "Sapi",
    translationNotesLabel: "Catatan terjemahan",
  },
} satisfies QuranLocaleContracts;
type QuranLocaleCase = (typeof quranLocaleContracts)[AppLocaleCode];

const verifyQuranInterpretationDrawer = Effect.fn(
  "NakafaE2E.verifyQuranInterpretationDrawer"
)(function* (page: Page) {
  yield* seedDeniedAnalyticsConsent(page);
  const response = yield* Effect.promise(() =>
    page.goto("/id/quran/2", { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  yield* waitForCommittedAppRouter(
    page,
    "/id/quran/2",
    "/id/quran/2",
    readinessTimeoutMilliseconds
  );

  const trigger = page.locator("[data-quran-interpretation-verse]").first();
  yield* Effect.promise(() => expect(trigger).toBeVisible({ timeout: 15_000 }));
  yield* Effect.promise(() => expect(trigger).toBeEnabled({ timeout: 15_000 }));
  yield* Effect.promise(() => trigger.click());

  const drawer = page.locator('[data-slot="drawer-popup"]');
  yield* Effect.promise(() => expect(drawer).toBeVisible({ timeout: 15_000 }));
  yield* Effect.promise(() =>
    expect(drawer.locator('[data-slot="drawer-bar"]')).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(drawer.locator('[data-slot="drawer-title"]')).toHaveText("Tafsir")
  );
  yield* Effect.promise(() =>
    expect(drawer.locator('[data-slot="drawer-panel"]')).not.toBeEmpty()
  );

  yield* Effect.promise(() => page.keyboard.press("Escape"));
  yield* Effect.promise(() => expect(drawer).toHaveCount(0));

  const quranIndexLink = page.locator('a[href="/id/quran"]').first();
  yield* Effect.promise(() => expect(quranIndexLink).toBeVisible());
  yield* Effect.promise(() => quranIndexLink.click());
  yield* Effect.promise(() => expect(page).toHaveURL(quranIndexUrlPattern));
  yield* Effect.promise(() => expect(trigger).toBeAttached());
  yield* Effect.promise(() => expect(trigger).toBeHidden());
  yield* Effect.promise(() => expect(trigger).toHaveCSS("opacity", "1"));

  yield* Effect.promise(() => page.goBack());
  yield* Effect.promise(() => expect(page).toHaveURL(quranSurahUrlPattern));
  yield* waitForCommittedAppRouter(
    page,
    "/id/quran",
    "/id/quran/2",
    readinessTimeoutMilliseconds
  );
  yield* Effect.promise(() => expect(trigger).toBeVisible());
  yield* Effect.promise(() => expect(trigger).toBeEnabled());
  yield* Effect.promise(() => expect(trigger).toHaveCSS("opacity", "1"));
  yield* Effect.promise(() => trigger.click());
  yield* Effect.promise(() => expect(drawer).toBeVisible({ timeout: 15_000 }));
  yield* Effect.promise(() => page.keyboard.press("Escape"));
  yield* Effect.promise(() => expect(drawer).toHaveCount(0));
});

const verifyQuranLocaleCoverage = Effect.fn(
  "NakafaE2E.verifyQuranLocaleCoverage"
)(function* (page: Page, contract: QuranLocaleCase) {
  yield* seedDeniedAnalyticsConsent(page);

  const href = `/${contract.locale}/quran/2`;
  const response = yield* Effect.promise(() =>
    page.goto(href, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  yield* waitForCommittedAppRouter(
    page,
    href,
    href,
    readinessTimeoutMilliseconds
  );

  const headerMeaning = page
    .locator("header p")
    .filter({ hasText: contract.meaning });
  yield* Effect.promise(() => expect(headerMeaning).toBeVisible());
  yield* Effect.promise(() =>
    expect(headerMeaning).toHaveAttribute("lang", contract.locale)
  );
  const sidebarMeaning = page
    .locator('[data-slot="sidebar-menu-description"]')
    .filter({ hasText: contract.meaning });
  yield* Effect.promise(() =>
    expect(sidebarMeaning).toHaveAttribute("lang", contract.locale)
  );

  const bismillah = page.locator("[data-quran-bismillah]");
  yield* Effect.promise(() => expect(bismillah).toBeVisible());
  yield* Effect.promise(() =>
    expect(bismillah.locator('[lang="ar"]')).toContainText("بِسْمِ")
  );
  yield* Effect.promise(() =>
    expect(
      page.locator('[data-quran-verse="1"] [data-quran-arabic]')
    ).toHaveText("الٓمٓ")
  );
  yield* Effect.promise(() =>
    expect(
      page.locator("[data-quran-interpretation-availability]")
    ).toHaveCount(0)
  );

  const interpretation = page.locator("[data-quran-interpretation-verse]");
  const interpretationLink = page.locator("[data-quran-interpretation-link]");
  if (contract.hasEmbeddedTafsir) {
    yield* Effect.promise(() => expect(interpretation.first()).toBeVisible());
    yield* Effect.promise(() => expect(interpretation.first()).toBeEnabled());
    yield* Effect.promise(() => expect(interpretationLink).toHaveCount(0));
  } else {
    yield* Effect.promise(() => expect(interpretation).toHaveCount(0));
    yield* Effect.promise(() =>
      expect(interpretationLink.first()).toBeVisible()
    );
    yield* Effect.promise(() =>
      expect(interpretationLink.first()).toHaveAttribute("target", "_blank")
    );
    yield* Effect.promise(() =>
      expect(interpretationLink.first()).toHaveAttribute("rel", "noreferrer")
    );
    const interpretationHref = yield* Effect.promise(() =>
      interpretationLink.first().getAttribute("href")
    );
    yield* Effect.sync(() =>
      expect(
        interpretationHref === null
          ? false
          : new URL(interpretationHref).protocol === "https:"
      ).toBe(true)
    );
  }

  const translationNotes = page.locator(
    `aside[aria-label^="${contract.translationNotesLabel}: "]`
  );
  if (contract.hasTranslationNotes) {
    yield* Effect.promise(() =>
      expect(
        page.getByText(contract.translationNotesLabel, { exact: true })
      ).toHaveCount(0)
    );
    yield* Effect.promise(() => expect(translationNotes.first()).toBeVisible());
    yield* Effect.promise(() =>
      expect(
        translationNotes
          .first()
          .locator("[data-quran-translation-note]")
          .first()
      ).toBeVisible()
    );
    const reference = page.locator('a[role="doc-noteref"]').first();
    yield* Effect.promise(() => expect(reference).toBeVisible());
    yield* Effect.promise(() =>
      expect(reference).toHaveAttribute("href", quranTranslationNoteHrefPattern)
    );
    yield* Effect.promise(() =>
      expect(
        translationNotes.first().locator('a[role="doc-backlink"]').first()
      ).toBeVisible()
    );
    const landmarkNames = yield* Effect.promise(() =>
      translationNotes.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("aria-label"))
      )
    );
    yield* Effect.sync(() =>
      expect(new Set(landmarkNames).size).toBe(landmarkNames.length)
    );
    const visibleTranslations = yield* Effect.promise(() =>
      page
        .locator("[data-quran-translation]")
        .evaluateAll((elements) =>
          elements.map((element) => element.textContent)
        )
    );
    yield* Effect.sync(() =>
      expect(
        visibleTranslations.every(
          (text) => !rawTranslationNotePattern.test(text ?? "")
        )
      ).toBe(true)
    );
  } else {
    yield* Effect.promise(() => expect(translationNotes).toHaveCount(0));
    yield* Effect.promise(() =>
      expect(page.locator('a[role="doc-noteref"]')).toHaveCount(0)
    );
  }

  const bibliographyHref = `/${contract.locale}/quran/1`;
  const bibliographyResponse = yield* Effect.promise(() =>
    page.goto(bibliographyHref, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(bibliographyResponse?.ok()).toBe(true));
  yield* waitForCommittedAppRouter(
    page,
    href,
    bibliographyHref,
    readinessTimeoutMilliseconds
  );

  const bibliography = page.locator("footer button").first();
  yield* Effect.promise(() => expect(bibliography).toBeVisible());
  yield* Effect.promise(() => bibliography.click());
  const bibliographySheet = page.locator('[data-slot="sheet-popup"]');
  yield* Effect.promise(() =>
    expect(bibliographySheet).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  const sourceLinks = bibliographySheet.locator('a[target="_blank"]');
  yield* Effect.promise(() => expect(sourceLinks).toHaveCount(3));
  yield* Effect.promise(() =>
    expect(sourceLinks.first()).toHaveAttribute("rel", "noopener noreferrer")
  );
  const sourceHrefs = yield* Effect.promise(() =>
    sourceLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute("href"))
    )
  );
  yield* Effect.sync(() =>
    expect(
      sourceHrefs.every((sourceHref) =>
        sourceHref === null ? false : new URL(sourceHref).protocol === "https:"
      )
    ).toBe(true)
  );
  yield* Effect.promise(() => page.keyboard.press("Escape"));
});

test.describe("Quran source and tafsir coverage", () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test("keeps the tafsir drawer content and dismissal behavior", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyQuranInterpretationDrawer(page))
    );
  });

  for (const contract of Object.values(quranLocaleContracts)) {
    test(`keeps ${contract.locale} translation notes and tafsir coverage truthful`, async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifyQuranLocaleCoverage(page, contract))
      );
    });
  }
});
