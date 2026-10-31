import { expect, type Page, test } from "@playwright/test";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Number as Num, Option, Schema } from "effect";

const MATERIAL_PATH =
  "/en/subjects/mathematics/function-composition-inverse-function/function-concept";
const MATERIAL_CONTEXT =
  "merdeka~class-11-mathematics-function-composition-inverse-function";
const CURRICULUM_PATH = "/en/curriculum/merdeka/class-11/mathematics";

/** The two widths the breadcrumb row is proven at: a phone and a desktop. */
const VIEWPORTS = [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
] as const;

/**
 * Samples the breadcrumb on every frame from the document's start: the text a
 * reader sees (none while the row is hidden), the address, the title's box, and
 * every layout shift that the browser reports. It runs before any page script.
 */
const SAMPLER = `(() => {
  const samples = [];
  const shifts = [];
  window.__placementPaint = { samples, shifts };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) shifts.push(entry.value);
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch (error) {}
  const visibleText = (element) => {
    for (let node = element; node; node = node.parentElement) {
      if (getComputedStyle(node).visibility === "hidden") return "";
    }
    return element.innerText.replace(/\\s+/g, " ").trim();
  };
  const sample = () => {
    const nav = document.querySelector('nav[aria-label="Breadcrumb"]');
    const title = document.querySelector("h1:not(.sr-only)");
    const box = title ? title.getBoundingClientRect() : null;
    const text = nav ? visibleText(nav) : "";
    const last = samples[samples.length - 1];
    const entry = {
      path: location.pathname,
      text,
      top: box ? Math.round(box.top) : null,
    };
    if (!last || last.path !== entry.path || last.text !== entry.text || last.top !== entry.top) {
      samples.push(entry);
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
})();`;

/** What the sampler recorded: each painted change of the breadcrumb, and every layout shift. */
const PaintRecord = Schema.Struct({
  samples: Schema.Array(
    Schema.Struct({
      path: Schema.String,
      text: Schema.String,
      top: Schema.NullOr(Schema.Finite),
    })
  ),
  shifts: Schema.Array(Schema.Finite),
});

/** Waits until the lesson's breadcrumb shows its placement, then a little longer, and returns what was painted. */
async function settle(page: Page) {
  await expect(
    page
      .getByRole("navigation", { name: "Breadcrumb", exact: true })
      .locator('a[href*="/curriculum/merdeka/class-11/mathematics"]')
  ).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(750);
  return Schema.decodeUnknownSync(PaintRecord)(
    await page.evaluate(() => Reflect.get(window, "__placementPaint"))
  );
}

/** The distinct breadcrumb texts that the lesson painted once its row showed anything. */
function paintedTexts(samples: (typeof PaintRecord.Type)["samples"]) {
  return Arr.dedupe(
    Arr.map(
      Arr.filter(
        samples,
        (sample) => sample.path === MATERIAL_PATH && sample.text !== ""
      ),
      (sample) => sample.text
    )
  );
}

/** The distinct tops that the lesson's title took while the breadcrumb settled. */
function titleTops(samples: (typeof PaintRecord.Type)["samples"]) {
  return Arr.dedupe(
    Arr.getSomes(
      Arr.map(
        Arr.filter(samples, (sample) => sample.path === MATERIAL_PATH),
        (sample) => Option.fromNullishOr(sample.top)
      )
    )
  );
}

for (const viewport of VIEWPORTS) {
  test(`the breadcrumb of a lesson under a curriculum hint paints once, on a hard load cold and warm, at ${viewport.width}px`, async ({
    browser,
    baseURL,
  }, testInfo) => {
    const context = await browser.newContext({
      baseURL: baseURL ?? "",
      viewport,
    });
    await context.addInitScript(SAMPLER);
    const page = await context.newPage();
    for (const visit of ["cold", "warm"]) {
      await page.goto(`${MATERIAL_PATH}?ctx=${MATERIAL_CONTEXT}`);
      const { samples, shifts } = await settle(page);
      const texts = paintedTexts(samples);
      const tops = titleTops(samples);
      const shift = Num.sumAll(shifts);
      await testInfo.attach(`paint-hard-${visit}-${viewport.width}.json`, {
        body: Buffer.from(encodeJsonText({ shift, texts, tops })),
        contentType: "application/json",
      });
      expect(texts, visit).toHaveLength(1);
      expect(shift, visit).toBe(0);
      expect(tops, visit).toHaveLength(1);
    }
    await context.close();
  });

  test(`the breadcrumb of a lesson reached from its curriculum paints once, at ${viewport.width}px`, async ({
    browser,
    baseURL,
  }, testInfo) => {
    const context = await browser.newContext({
      baseURL: baseURL ?? "",
      viewport,
    });
    await context.addInitScript(SAMPLER);
    const page = await context.newPage();
    await page.goto(CURRICULUM_PATH);
    const link = page.locator('a[href*="/function-concept?ctx="]').first();
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page).toHaveURL(new RegExp(MATERIAL_PATH, "u"));
    const { samples } = await settle(page);
    const texts = paintedTexts(samples);
    await testInfo.attach(`paint-client-${viewport.width}.json`, {
      body: Buffer.from(encodeJsonText({ texts })),
      contentType: "application/json",
    });
    expect(texts).toHaveLength(1);
    await context.close();
  });
}

test("the breadcrumb of a lesson whose match the router already holds paints once under the hint of its curriculum card", async ({
  browser,
  baseURL,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: baseURL ?? "",
    viewport: { height: 900, width: 1440 },
  });
  await context.addInitScript(SAMPLER);
  const page = await context.newPage();
  // The lesson loads first without a hint, so the router holds its match, keyed
  // by the lesson's path alone, with no placement in it.
  await page.goto(MATERIAL_PATH);
  await page.waitForFunction(() => window.__TSR_ROUTER__ !== undefined);
  await page.evaluate(
    (href) => window.__TSR_ROUTER__?.navigate({ href }),
    CURRICULUM_PATH
  );
  await expect(page).toHaveURL(new RegExp(`${CURRICULUM_PATH}$`, "u"));
  // Only what the lesson paints after the press counts.
  await page.evaluate(() => {
    Reflect.get(window, "__placementPaint").samples.length = 0;
  });
  const link = page.locator('a[href*="/function-concept?ctx="]').first();
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await expect(page).toHaveURL(new RegExp(MATERIAL_PATH, "u"));
  const { samples } = await settle(page);
  const texts = paintedTexts(samples);
  await testInfo.attach("paint-held-match.json", {
    body: Buffer.from(encodeJsonText({ texts })),
    contentType: "application/json",
  });
  expect(texts).toHaveLength(1);
  await context.close();
});
