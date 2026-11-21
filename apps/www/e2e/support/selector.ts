import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Locator, Page } from "@playwright/test";
import de from "@repo/internationalization/dictionaries/de.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import id from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import ms from "@repo/internationalization/dictionaries/ms.json" with {
  type: "json",
};

/**
 * The alerts a page or a part of it shows. UI SDK keeps a live region of its own for what it announces, an empty
 * `role="alert"` until it speaks (`data-ui-sdk-announcer`), which is no alert of the page, so it is left out.
 */
export const shownAlerts = (scope: Page | Locator) =>
  scope.getByRole("alert").and(scope.locator(":not([data-ui-sdk-announcer])"));

/** The site's messages in each of its languages. */
const MESSAGES = { de, en, id, ms } satisfies Record<
  ActiveAppLocaleCode,
  typeof en
>;

/** A content card, which a lesson or a Quran page shows. */
export const CARD = '[data-slot="card"]';
/** A message bubble, which holds the words of a prompt or of an answer. */
export const BUBBLE = '[data-slot="bubble"]';
/** The box inside a bubble that holds its words. */
export const BUBBLE_CONTENT = '[data-slot="bubble-content"]';
/** A row of a chat transcript: one for each message, and the alert of a failed turn. */
export const TRANSCRIPT_ROW = '[data-slot="message-scroller-item"]';
/**
 * What Markdown makes of text: emphasis, code, links, lists and headings. The
 * words of a learner, shown as they wrote them, make none of these.
 */
export const MARKDOWN_MARKUP = "em, strong, code, pre, a, ul, ol, h1, h2, h3";
/**
 * The list that holds the toasts. They stack over the page and move on their
 * own, so a toast moving is not the page moving.
 */
export const TOASTER = "[data-slot=toast-region]";
/**
 * The dialog on top. A popup renders where it is written, so a dialog that a
 * control inside another dialog opens, such as a phone's sheet, renders inside
 * that dialog and comes after it in the page.
 */
export function topDialog(page: Page) {
  return page.getByRole("dialog").last();
}
/**
 * The toasts on the page that contain `text`. A toast's words are also in the
 * live region that announces it to a screen reader, so a toast is read from the
 * toast itself, never from the page's text.
 */
export function noticeWith(page: Page, text: string) {
  return page.locator("[data-slot=toast]").filter({ hasText: text });
}
/**
 * The tooltip that shows. Every tooltip stays in the page, hidden, from the first HTML, since it names or describes
 * its trigger (`@ui-sdk/react/docs/components/tooltip.md`), so only the open one is selected.
 */
export const TOOLTIP = '[data-slot="tooltip-content"][data-open]';
/**
 * The header's open section. The navigation menu's viewport stays in the page while every section is closed
 * (without `data-open`), so only the open one is selected.
 */
export const HEADER_SECTION =
  '[data-slot="navigation-menu-viewport"][data-open]';
/**
 * The popup of an open sheet, which a learner opens from the side of a page.
 * Nina's sheet stays mounted while closed, so only the open one is selected.
 */
export const SHEET_POPUP = '[data-surface="sheet"][data-open]';
/** A deferred MathVisual scene inside a lesson card, plane or space. */
export const MATH_SCENE = '[data-scene="math"]';
/** The actions band of a 3D scene: its own actions, then play, reset and full screen. */
export const SCENE_ACTIONS = "[data-scene-actions]";
/** The sidebar trigger in a Quran surah's header, which opens its outline. */
export const SURAH_SIDEBAR_TRIGGER =
  'header [data-slot="page-actions"] button[data-sidebar="trigger"]';
/** The sidebar trigger that a narrow viewport shows, which opens the sidebar. */
export const VISIBLE_SIDEBAR_TRIGGER = '[data-sidebar="trigger"]:visible';
/** The main element of a marketing page, which marks the page as one. */
export const MARKETING_PAGE = 'main[data-marketing-page="true"]';
/** The Nina part of the homepage, which holds its own composer. */
export const NINA_SECTION = "#nina";
/** A learner's profile inside the app shell's `<main>`: its header, its tabs and the tab open. */
export const PROFILE_PAGE = 'main [data-slot="profile"]';
/** A visual card, which wraps a lesson's lab, chart, or 3D scene. */
export const VISUAL_CARD = '[data-slot="visual-card"]';
/** The toolbar of a visual card: the controls that change what the visual shows. */
export const VISUAL_CARD_TOOLBAR = '[data-slot="visual-card-toolbar"]';
/** The values table of a visual card, the band under a function chart that lists its points. */
export const VISUAL_CARD_TABLE = '[data-slot="visual-card-table"]';
/** The footer band of a visual card, which holds its readouts, legends and notes. */
export const VISUAL_CARD_FOOTER = '[data-slot="visual-card-footer"]';
/** The place of Nina on a full-page state, which holds her and the things beside her. */
export const STATE_FIGURE = '[data-slot="empty-icon"]';
/** A link to a subject lesson, such as the neighbors that lesson pagination shows. */
export const SUBJECT_LINK = 'a[href^="/en/subjects/"]';

/** The cards that hold a deferred MathVisual scene. */
export function mathSceneCards(page: Page) {
  return page.locator(CARD).filter({ has: page.locator(MATH_SCENE) });
}

/** The pagination navigation that links a lesson to its neighbors, named in the page's language. */
export function paginationNavigation(
  page: Page,
  locale: ActiveAppLocaleCode = "en"
) {
  return page.getByRole("navigation", {
    name: MESSAGES[locale].Common["page-navigation"],
  });
}
