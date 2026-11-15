import { expect, type Locator, type Page } from "@playwright/test";

/** Presses Escape in the editor and dumps what the page did when it stays open. */
export async function escapeProbe(page: Page, editor: Locator) {
  await page.evaluate(() => {
    const w = window as unknown as { __p: unknown[] };
    w.__p = [];
    const desc = (t: EventTarget | null) =>
      t instanceof Element
        ? `${t.tagName}#${t.id}[${t.getAttribute("data-slot") ?? ""}]`
        : String(t);
    document.addEventListener(
      "keydown",
      (e) => w.__p.push(["kd-cap", e.key, desc(e.target), performance.now()]),
      true
    );
    window.addEventListener("keydown", (e) =>
      w.__p.push(["kd-win", e.key, e.defaultPrevented, performance.now()])
    );
    for (const t of [
      "transitionrun",
      "transitionstart",
      "transitionend",
      "transitioncancel",
      "animationstart",
      "animationend",
      "animationcancel",
    ]) {
      document.addEventListener(
        t,
        (e) =>
          w.__p.push([
            t,
            (e as TransitionEvent).propertyName ??
              (e as AnimationEvent).animationName,
            desc(e.target),
            performance.now(),
          ]),
        true
      );
    }
  });
  await editor.press("Escape");
  try {
    await expect(editor).toHaveCount(0);
  } catch (error) {
    const dump = await page.evaluate(async () => {
      const w = window as unknown as { __p: unknown[] };
      let ticks = 0;
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const step = () => {
          ticks += 1;
          if (performance.now() - start > 1000) {
            resolve();
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      const sheet = document.querySelector("[data-slot=sheet-content]");
      return {
        active: document.activeElement?.outerHTML.slice(0, 160),
        animations: document.getAnimations().map((a) => ({
          name: (a as CSSTransition).transitionProperty ?? a.id,
          state: a.playState,
          time: a.currentTime,
          target:
            a.effect instanceof KeyframeEffect
              ? (a.effect.target as Element | null)?.getAttribute("data-slot")
              : null,
        })),
        events: w.__p,
        focus: document.hasFocus(),
        rafTicksPerSecond: ticks,
        sheet: sheet
          ? Array.from(sheet.attributes).map((x) => `${x.name}=${x.value.slice(0, 40)}`)
          : null,
        visibility: document.visibilityState,
      };
    });
    console.log("SHEETPROBE", JSON.stringify(dump));
    throw error;
  }
}
