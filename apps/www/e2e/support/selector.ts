import type { Page } from "@playwright/test";

/** A content card, which a lesson or a Quran page shows. */
export const CARD = '[data-slot="card"]';
/** The popup of a drawer, which a phone opens for the consent and contributor surfaces. */
export const DRAWER_POPUP = '[data-slot="drawer-popup"]';
/** The bar at the top of a drawer, which a swipe drags. */
export const DRAWER_BAR = '[data-slot="drawer-bar"]';
/** The popup of a sheet, which a learner opens from the side of a page. */
export const SHEET_POPUP = '[data-slot="sheet-popup"]';
/** A deferred 3D line scene inside a lesson card. */
export const LINE_SCENE = '[data-slot="line-scene"]';
/** The controls below a 3D scene: its grid, its rotation, and its readout. */
export const COORDINATE_CONTROLS = "[data-coordinate-controls]";
/** The sidebar trigger in a Quran surah's header, which opens its outline. */
export const SURAH_SIDEBAR_TRIGGER =
  'header [data-slot="surah-header-actions"] button[data-sidebar="trigger"]';

/** The cards that hold a deferred 3D line scene. */
export function lineSceneCards(page: Page) {
  return page.locator(CARD).filter({ has: page.locator(LINE_SCENE) });
}

/** The pagination navigation that links a lesson to its neighbors. */
export function paginationNavigation(page: Page) {
  return page.getByRole("navigation", { name: "Pagination navigation" });
}
