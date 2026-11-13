import { expect, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect, Record as Rec } from "effect";
import { withoutRawKeys } from "@/e2e/support/keys";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

const TRACK_PATH = "/en/try-out/indonesia/snbt/2027/utbk";
const HEADS = {
  duration: en.Tryouts["set-column-duration"],
  name: en.Common.name,
  questions: en.Common["exam-questions"],
  score: en.Tryouts["set-column-score"],
  status: en.Common.state,
};

/**
 * The try-out table showed the raw key `DataTable.sort` over its sort on production, and its Questions, Duration and
 * Score heads only sorted. Every head filters what its column holds now, each panel sorts in the column's own words, and
 * no message reaches the page without its text. A head that sorts reads its column's name, as every data table's heads do.
 */
test("every head of a try-out table filters its column, and no menu shows a raw key", async ({
  page,
}) => {
  await Effect.runPromise(
    withoutRawKeys(
      page,
      TRACK_PATH,
      Effect.promise(async () => {
        await page.goto(TRACK_PATH, { waitUntil: "load" });
        const table = page.getByRole("table");
        const rows = table.getByRole("row");
        await expect(rows.nth(1)).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        await waitUntilTakenOver(
          table.getByRole("button", { exact: true, name: HEADS.name })
        );
        // Every head in `HEADS`, and the one over the row's menu.
        expect(await table.getByRole("columnheader").count()).toBe(
          Arr.length(Rec.values(HEADS)) + 1
        );
        const total = await rows.count();

        await table
          .getByRole("button", { exact: true, name: HEADS.name })
          .click();
        await expect(
          page.getByRole("button", {
            name: en.DataTable["sort-a-z"],
          })
        ).toBeVisible();
        await page
          .getByRole("textbox", { name: HEADS.name })
          .fill("no such set");
        await expect(table.getByText(en.DataTable["no-results"])).toBeVisible();
        await page.getByRole("button", { name: en.DataTable.reset }).click();
        await expect(rows).toHaveCount(total);
        await page.keyboard.press("Escape");

        for (const column of [HEADS.questions, HEADS.duration, HEADS.score]) {
          await table
            .getByRole("button", { exact: true, name: column })
            .click();
          await page
            .getByRole("textbox", {
              name: `${column}, ${en.DataTable["filter-lowest"]}`,
            })
            .fill("99999");
          await expect(
            table.getByText(en.DataTable["no-results"])
          ).toBeVisible();
          await page.getByRole("button", { name: en.DataTable.reset }).click();
          await expect(rows).toHaveCount(total);
          await page.keyboard.press("Escape");
        }
      })
    )
  );
});
