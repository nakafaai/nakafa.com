import {
  type BrowserContext,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import { Array as Arr, Effect, MutableHashSet, MutableList } from "effect";
import {
  expectSteady,
  expectSteadyReloads,
  POPUPS,
  recordSteadiness,
  takeFlickers,
  takeMoves,
} from "@/e2e/support/flicker";
import { readRawKeys } from "@/e2e/support/keys";
import { readTallRows } from "@/e2e/support/wraps";

/** The most pages one walk opens, past the routes a school has, so a walk always ends. */
const PAGE_LIMIT = 90;

/** How long one press is watched, past the 300 ms a popup takes to open. */
const PRESS_MILLISECONDS = 620;

/** How long a press waits for a control the page may have taken away. */
const PRESS_TIMEOUT_MILLISECONDS = 2000;

/** WebKit's words for a request the page left behind as it moved on, which fails nothing a reader sees. */
export const LEFT_BEHIND = /due to access control checks/u;

/** A Convex ID in an address, so a walk opens one page of each kind. */
const DOCUMENT_ID = /^[0-9a-z]{31,37}$/u;

/** The space between two words of a label. */
const WORD_BREAK = /\s+/u;

/** The address of a page without its query, with each ID folded. */
const shapeOf = (address: string) =>
  Arr.join(
    Arr.map(new URL(address).pathname.split("/"), (part) =>
      DOCUMENT_ID.test(part) ? ":id" : part
    ),
    "/"
  );

/**
 * What the page shows that a reader sees at once: its links, neighbouring controls that touch or differ
 * in height, and a path cut to a stub. Groups draw their parts together by design, and a table scrolls.
 * The page serializes this function, so it holds every part it reads.
 */
function readFacts() {
  const shown = (element: Element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };
  const name = (element: HTMLElement) =>
    element.getAttribute("aria-label") ??
    element.textContent?.trim().slice(0, 24) ??
    element.tagName;
  const controls = Array.from(
    document.querySelectorAll<HTMLElement>(
      'main button, main input, main textarea, main [role="combobox"]'
    )
  ).filter(shown);
  const problems = Array.from(
    new Set(controls.map((control) => control.parentElement))
  ).flatMap((parent) => {
    if (
      parent === null ||
      parent.closest(
        '[data-slot="button-group"], [data-slot="input-group"], [role="tablist"], [role="group"], [role="radiogroup"], table'
      )
    ) {
      return [];
    }
    const row = Array.from(parent.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && controls.includes(child)
    );
    return row.slice(1).flatMap((after, index) => {
      const before = row[index];
      if (before === undefined) {
        return [];
      }
      const first = before.getBoundingClientRect();
      const second = after.getBoundingClientRect();
      if (second.top >= first.bottom || first.top >= second.bottom) {
        return [];
      }
      const pair = `"${name(before)}" and "${name(after)}"`;
      return [
        ...(second.left - first.right < 2 ? [`${pair} touch`] : []),
        ...(Math.abs(first.height - second.height) > 1
          ? [`${pair} differ in height`]
          : []),
      ];
    });
  });
  const stubs = Array.from(
    document.querySelectorAll<HTMLElement>('[data-slot="page-header"] nav li a')
  )
    .filter(
      (crumb) =>
        shown(crumb) &&
        crumb.scrollWidth > crumb.clientWidth &&
        crumb.clientWidth < 48
    )
    .map((crumb) => `the path cuts "${crumb.textContent}"`);
  return {
    links: Array.from(
      document.querySelectorAll<HTMLAnchorElement>("a[href]")
    ).map((link) => link.href),
    problems: [...problems, ...stubs],
    sideways:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  };
}

/**
 * Follows the popup on top, frame by frame, for `span` milliseconds. A popup that holds until its read is
 * in is hidden in those frames, so only what a reader can see counts: its height, and whether a loader shows.
 */
function followPopup({ popups, span }: { popups: string; span: number }) {
  return new Promise<{ heights: number[]; loading: boolean }>((resolve) => {
    const heights: number[] = [];
    let loading = false;
    const start = performance.now();
    const tick = (now: number) => {
      const popup = Array.from(document.querySelectorAll<HTMLElement>(popups))
        .filter(
          (one) => one.offsetHeight > 0 && !one.hasAttribute("data-closed")
        )
        .at(-1);
      if (
        popup !== undefined &&
        getComputedStyle(popup).visibility !== "hidden"
      ) {
        heights.push(popup.offsetHeight);
        loading ||=
          popup.querySelector('.animate-spin, [data-slot="skeleton"]') !== null;
      }
      if (now - start < span) {
        requestAnimationFrame(tick);
        return;
      }
      resolve({ heights: Array.from(new Set(heights)), loading });
    };
    requestAnimationFrame(tick);
  });
}

/** What the popup on top holds, or `null` when no popup stands. The page serializes this function. */
function readPopup(popups: string) {
  const popup = Array.from(document.querySelectorAll<HTMLElement>(popups))
    .filter((one) => one.offsetHeight > 0 && !one.hasAttribute("data-closed"))
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
    closes: popup.querySelectorAll('[data-slot="sheet-close"]').length,
    inside:
      box.left >= -1 &&
      box.top >= -1 &&
      box.right <= window.innerWidth + 1 &&
      box.bottom <= window.innerHeight + 1,
    items: popup.querySelectorAll('[role^="menuitem"], [role="option"]').length,
    labels: Array.from(
      popup.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-label"]')
    ).flatMap((label) =>
      // The account menu's label is the account: its name and role beside its picture.
      label.querySelector('[data-slot="avatar"]') === null
        ? [label.textContent.trim()]
        : ["Account"]
    ),
    slot: popup.getAttribute("data-slot") ?? "",
    wide: popup.scrollWidth - popup.clientWidth > 1,
  };
}

/** What a reader must find in a popup, by its kind. */
const expectWhole = (
  popup: NonNullable<ReturnType<typeof readPopup>>,
  label: string
) => {
  expect.soft(popup.inside, `${label}: stands inside the screen`).toBe(true);
  expect.soft(popup.wide, `${label}: never scrolls sideways`).toBe(false);
  if (popup.slot === "sheet-popup") {
    expect.soft(popup.footer, `${label}: has a footer`).toBe(true);
  }
  expect
    .soft(popup.repeats, `${label}: repeats no close in its footer`)
    .toBe(0);
  if (popup.slot === "sheet-popup") {
    expect.soft(popup.closes, `${label}: closes from its corner only`).toBe(1);
  }
  if (popup.slot === "select-content") {
    expect.soft(popup.items, `${label}: holds an item`).toBeGreaterThan(0);
  }
  if (popup.slot !== "dropdown-menu-content") {
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

/** The name of a control that opens something, with where it stands. */
const nameOf = (trigger: Locator) =>
  trigger
    .evaluate(
      (control) => {
        const side =
          control.closest(
            '[data-slot="sidebar-content"], [data-slot="sidebar"]'
          ) === null
            ? ""
            : "sidebar ";
        const words =
          control.getAttribute("aria-label") ??
          control.textContent?.trim().slice(0, 32) ??
          "";
        return `${side}${words}`;
      },
      undefined,
      { timeout: PRESS_TIMEOUT_MILLISECONDS }
    )
    .catch(() => "");

/** Presses one control that opens something, reads what it opened, and closes it. */
const pressTrigger = async (
  page: Page,
  {
    address,
    label,
    trigger,
  }: { address: string; label: string; trigger: Locator }
) => {
  const [followed, pressed] = await Promise.all([
    page
      .evaluate(followPopup, { popups: POPUPS, span: PRESS_MILLISECONDS })
      .catch(() => ({ heights: [], loading: false })),
    trigger
      .click({ timeout: PRESS_TIMEOUT_MILLISECONDS })
      .then(() => true)
      .catch(() => false),
  ]);
  expect.soft(pressed, `${label}: takes a press`).toBe(true);
  if (!pressed) {
    return;
  }
  const popup = await page.evaluate(readPopup, POPUPS);
  if (popup === null) {
    // A control that names no popup leaves the page or draws in place, so the page opens again.
    await page.goto(address);
    return;
  }
  expectWhole(popup, label);
  expect
    .soft(followed.heights.length, `${label}: holds its height`)
    .toBeLessThanOrEqual(1);
  expect.soft(followed.loading, `${label}: shows no loader`).toBe(false);
  await page.keyboard.press("Escape");
  const closed = await page
    .waitForFunction(
      (popups) =>
        Array.from(document.querySelectorAll<HTMLElement>(popups)).every(
          (one) => one.offsetHeight === 0 || one.hasAttribute("data-closed")
        ),
      POPUPS,
      { timeout: PRESS_TIMEOUT_MILLISECONDS }
    )
    .then(() => true)
    .catch(() => false);
  expect.soft(closed, `${label}: closes on Escape`).toBe(true);
  if (!closed) {
    await page.goto(address);
  }
};

/** Presses every control of the page that opens something, one of each name. */
const pressTriggers = async (
  page: Page,
  address: string,
  pressed: MutableHashSet.MutableHashSet<string>
) => {
  const shape = shapeOf(address);
  const triggers = page.locator("[aria-haspopup]:visible");
  const onPage = MutableHashSet.empty<string>();
  const count = await triggers.count();
  if (count === 0) {
    return;
  }
  for (const index of Arr.range(0, count - 1)) {
    const trigger = triggers.nth(index);
    const name = await nameOf(trigger);
    const once = name.startsWith("sidebar ") ? pressed : onPage;
    const disabled = await trigger
      .isDisabled({ timeout: PRESS_TIMEOUT_MILLISECONDS })
      .catch(() => true);
    if (name === "" || disabled || MutableHashSet.has(once, name)) {
      continue;
    }
    MutableHashSet.add(once, name);
    await pressTrigger(page, {
      address,
      label: `${shape} > ${name}`,
      trigger,
    });
  }
};

/**
 * Opens every page a role reaches from the school's home, each kind once and `seeds` besides, and
 * presses every control that opens something. Every miss of the defect bar that a machine can read
 * stands as a soft failure, so one run names them all: a page that moves as it loads or scrolls
 * sideways, a page that moves, blanks or falls back on a hard reload or a step back and forward, a raw
 * key, a page error, controls that touch, a popup that moves, cuts or holds nothing.
 */
export const walkSchool = async (
  context: BrowserContext,
  origin: string,
  seeds: readonly string[]
) => {
  await recordSteadiness(context);
  const page = await context.newPage();
  const errors = MutableList.make<string>();
  page.on("pageerror", (error) => {
    if (!LEFT_BEHIND.test(error.message)) {
      MutableList.append(errors, `${page.url()}: ${error.message}`);
    }
  });
  const opened = MutableHashSet.empty<string>();
  const pressed = MutableHashSet.empty<string>();
  const queue = MutableList.make<string>();
  MutableList.appendAll(queue, [
    `${origin}/`,
    ...Arr.map(seeds, (path) => `${origin}${path}`),
  ]);

  while (queue.length > 0 && MutableHashSet.size(opened) < PAGE_LIMIT) {
    const address = MutableList.take(queue);
    if (address === MutableList.Empty) {
      break;
    }
    const shape = shapeOf(address);
    if (MutableHashSet.has(opened, shape)) {
      continue;
    }
    MutableHashSet.add(opened, shape);
    await page.goto(address);
    await page.waitForLoadState("networkidle");
    const facts = await page.evaluate(readFacts);
    expect.soft(facts.problems, `${shape}: stands apart`).toEqual([]);
    expect
      .soft(
        await page.evaluate(readTallRows),
        `${shape}: keeps rows on one line`
      )
      .toEqual([]);
    expect
      .soft(await Effect.runPromise(readRawKeys(page)), `${shape}: no raw key`)
      .toEqual([]);
    expect.soft(facts.sideways, `${shape}: never scrolls sideways`).toBe(0);
    await expectSteady(page, `${shape} as it loads`);
    await expectSteadyReloads(page, shape, MutableHashSet.size(opened) > 1);
    MutableList.appendAll(
      queue,
      Arr.filter(
        facts.links,
        (link) =>
          new URL(link).origin === origin &&
          !link.includes("/api/") &&
          !MutableHashSet.has(opened, shapeOf(link))
      )
    );
    await pressTriggers(page, address, pressed);
    expect
      .soft(await takeMoves(page), `${shape}: holds still under its popups`)
      .toEqual([]);
    expect
      .soft(
        await takeFlickers(page),
        `${shape}: never blanks or falls back under its popups`
      )
      .toEqual([]);
  }
  expect.soft(MutableList.toArray(errors), "no page error").toEqual([]);
  await page.close();
  return Arr.fromIterable(opened);
};
