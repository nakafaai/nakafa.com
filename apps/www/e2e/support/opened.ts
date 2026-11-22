import { expect } from "@playwright/test";
import { Array as Arr } from "effect";

/** The space between two words of a label. */
const WORD_BREAK = /\s+/u;

/** What the popup on top holds, or `null` when no popup stands. The page serializes this function. */
export function readPopup(popups: string) {
  const popup = Array.from(document.querySelectorAll<HTMLElement>(popups))
    .filter(
      (one) =>
        one.offsetHeight > 0 &&
        one.hasAttribute("data-open") &&
        !one.hasAttribute("data-ending-style")
    )
    .at(-1);
  if (popup === undefined) {
    return null;
  }
  const box = popup.getBoundingClientRect();
  return {
    footer:
      popup.querySelector(
        '[data-slot="dialog-footer"], [data-slot="sheet-footer"]'
      ) !== null,
    // A footer's Cancel or Close, which the close in the corner already is, in every language the walk reads.
    repeats: Array.from(
      popup.querySelectorAll(
        '[data-slot="dialog-footer"] button, [data-slot="drawer-footer"] button'
      )
    ).filter((button) =>
      ["Cancel", "Close", "Batal", "Tutup", "Abbrechen", "Schließen"].includes(
        button.textContent.trim()
      )
    ).length,
    // The sheet's close in its corner, which a Button draws and so wears the Button's slot.
    closes: popup.querySelectorAll('[data-sheet="close"]').length,
    orphans: Array.from(popup.querySelectorAll<HTMLLabelElement>("label[for]"))
      .filter((label) => label.control === null)
      .map((label) => label.textContent.trim().slice(0, 24)),
    // A popup renders beside its trigger (`@ui-sdk/react/docs/popups.md`), so a link, a button or a label around it
    // would take its presses as their own, and a form around one that holds a form would take its submit.
    caught:
      popup.parentElement?.closest("a[href], button, label, summary")
        ?.tagName ?? null,
    nestedForm:
      popup.querySelector("form") !== null &&
      popup.parentElement?.closest("form") !== null,
    // Beside its trigger, a popup stands in a place that takes no room (`PopupPlace`), so its trigger's row lays out as
    // if it were not there; a popup of an editor's node view renders at the end of the body instead (ADR 0049).
    placed: (() => {
      const place = popup.closest<HTMLElement>("[data-popup-place]");
      if (place === null) {
        return popup.parentElement === document.body;
      }
      const room = place.getBoundingClientRect();
      return (
        room.width === 0 &&
        room.height === 0 &&
        getComputedStyle(place).position === "absolute"
      );
    })(),
    inside:
      box.left >= -1 &&
      box.top >= -1 &&
      box.right <= window.innerWidth + 1 &&
      box.bottom <= window.innerHeight + 1,
    items: popup.querySelectorAll('[role^="menuitem"], [role="option"]').length,
    labels: Array.from(
      popup.querySelectorAll<HTMLElement>('[data-slot="menu-group-label"]')
    ).flatMap((label) =>
      // The account menu's face, its name and role beside its picture, stands under the menu's own label.
      label.querySelector('[data-slot="avatar"]') === null
        ? [label.textContent.trim()]
        : []
    ),
    // A field's label that breaks onto a second line, which a popup's width must always leave room for.
    broken: Array.from(
      popup.querySelectorAll<HTMLElement>('[data-slot="field-label"]')
    ).filter(
      (label) =>
        label.getBoundingClientRect().height >
        Number.parseFloat(getComputedStyle(label).lineHeight) * 1.5
    ).length,
    slot:
      popup.getAttribute("data-surface") ??
      popup.getAttribute("data-slot") ??
      "",
    // The popup, or a body that scrolls inside it, that is wider than its frame and lets the reader scroll sideways.
    // A body that clips sideways (overflow-x hidden) scrolls down only. A table's own scroll inside its card is the
    // table's, which may scroll sideways (docs/adr/0021-rules.md, "Overlays scroll downwards only").
    wide: [
      popup,
      ...Array.from(
        popup.querySelectorAll<HTMLElement>(
          '[data-slot="scroll-area-viewport"]'
        )
      ).filter(
        (viewport) => viewport.closest('[data-table="container"]') === null
      ),
    ].some(
      (box) =>
        box.scrollWidth - box.clientWidth > 1 &&
        getComputedStyle(box).overflowX !== "hidden"
    ),
  };
}

/** What a reader must find in a popup, by its kind. */
export const expectWhole = (
  popup: NonNullable<ReturnType<typeof readPopup>>,
  label: string
) => {
  expect.soft(popup.inside, `${label}: stands inside the screen`).toBe(true);
  expect.soft(popup.wide, `${label}: never scrolls sideways`).toBe(false);
  expect.soft(popup.broken, `${label}: breaks no field label`).toBe(0);
  expect
    .soft(popup.orphans, `${label}: every label names its control`)
    .toEqual([]);
  expect
    .soft(popup.caught, `${label}: sits in no link, button or label`)
    .toBeNull();
  expect
    .soft(popup.nestedForm, `${label}: holds no form inside another`)
    .toBe(false);
  expect
    .soft(popup.placed, `${label}: stands in a place that takes no room`)
    .toBe(true);
  if (popup.slot === "sheet") {
    expect.soft(popup.footer, `${label}: has a footer`).toBe(true);
  }
  expect
    .soft(popup.repeats, `${label}: repeats no close in its footer`)
    .toBe(0);
  if (popup.slot === "sheet") {
    expect.soft(popup.closes, `${label}: closes from its corner only`).toBe(1);
  }
  if (popup.slot === "select-content") {
    expect.soft(popup.items, `${label}: holds an item`).toBeGreaterThan(0);
  }
  if (popup.slot !== "menu-content") {
    return;
  }
  expect.soft(popup.items, `${label}: holds an item`).toBeGreaterThan(0);
  expect.soft(popup.labels, `${label}: has a label`).not.toEqual([]);
  expect
    .soft(Arr.dedupe(popup.labels), `${label}: reads no label twice`)
    .toEqual(popup.labels);
  for (const name of popup.labels) {
    expect
      .soft(name.split(WORD_BREAK).length, `${label}: "${name}" is one word`)
      .toBe(1);
  }
};
