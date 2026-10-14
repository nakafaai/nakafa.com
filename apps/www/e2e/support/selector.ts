import type { Page } from "@playwright/test";

/** A content card, which a lesson or a Quran page shows. */
export const CARD = '[data-slot="card"]';
/** A message bubble, which holds the words of a prompt or of an answer. */
export const BUBBLE = '[data-slot="bubble"]';
/** The box inside a bubble that holds its words. */
export const BUBBLE_CONTENT = '[data-slot="bubble-content"]';
/**
 * What Markdown makes of text: emphasis, code, links, lists and headings. The
 * words of a learner, shown as they wrote them, make none of these.
 */
export const MARKDOWN_MARKUP = "em, strong, code, pre, a, ul, ol, h1, h2, h3";
/**
 * The list that holds the toasts. They stack over the page and move on their
 * own, so a toast moving is not the page moving.
 */
export const TOASTER = "[data-sonner-toaster]";
/** The popup of a drawer, which a phone opens for the consent and contributor surfaces. */
export const DRAWER_POPUP = '[data-slot="drawer-popup"]';
/** The bar at the top of a drawer, which a swipe drags. */
export const DRAWER_BAR = '[data-slot="drawer-bar"]';
/** The title of a drawer, which names the surface a learner opened. */
export const DRAWER_TITLE = '[data-slot="drawer-title"]';
/** The content panel of a drawer, below its title. */
export const DRAWER_PANEL = '[data-slot="drawer-panel"]';
/**
 * The popup of an open sheet, which a learner opens from the side of a page.
 * Nina's sheet stays mounted while closed, so only the open one is selected.
 */
export const SHEET_POPUP = '[data-slot="sheet-popup"][data-open]';
/** A deferred 3D line scene inside a lesson card. */
export const LINE_SCENE = '[data-slot="line-scene"]';
/** The controls below a 3D scene: its grid, its rotation, and its readout. */
export const COORDINATE_CONTROLS = "[data-coordinate-controls]";
/** The sidebar trigger in a Quran surah's header, which opens its outline. */
export const SURAH_SIDEBAR_TRIGGER =
  'header [data-slot="surah-header-actions"] button[data-sidebar="trigger"]';
/** The sidebar trigger that a narrow viewport shows, which opens the sidebar. */
export const VISIBLE_SIDEBAR_TRIGGER = '[data-slot="sidebar-trigger"]:visible';
/** The main element of a marketing page, which marks the page as one. */
export const MARKETING_PAGE = 'main[data-marketing-page="true"]';
/** The Nina part of the homepage, which holds its own composer. */
export const NINA_SECTION = "#nina";
/** A visual card, which wraps a lesson's lab, chart, or 3D scene. */
export const VISUAL_CARD = '[data-slot="visual-card"]';
/** The place of Nina on a full-page state, which holds her and the things beside her. */
export const STATE_FIGURE = '[data-slot="empty-icon"]';
/** A link to a subject lesson, such as the neighbors that lesson pagination shows. */
export const SUBJECT_LINK = 'a[href^="/en/subjects/"]';

/** The cards that hold a deferred 3D line scene. */
export function lineSceneCards(page: Page) {
  return page.locator(CARD).filter({ has: page.locator(LINE_SCENE) });
}

/** The pagination navigation that links a lesson to its neighbors. */
export function paginationNavigation(page: Page) {
  return page.getByRole("navigation", { name: "Pagination navigation" });
}
