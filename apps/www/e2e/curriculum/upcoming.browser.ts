import { expect, test } from "@playwright/test";
import de from "@repo/internationalization/dictionaries/de.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import id from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import { MutableList } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";

const dictionaries = { de, en, id } as const;

/**
 * A learn page with no content yet shows the coming-soon body in its own
 * language. The learn layout loads that body's messages, so the static page and
 * the hydrated one show every label and report no missing message.
 */
for (const locale of ["de", "en", "id"] as const) {
  test(`an empty curriculum page says coming soon in ${locale}`, async ({
    page,
  }) => {
    const copy = dictionaries[locale].ComingSoon;
    const missing = MutableList.make<string>();
    page.on("console", (message) => {
      if (message.text().includes("MISSING_MESSAGE")) {
        MutableList.append(missing, message.text());
      }
    });

    await page.goto(pinnedRoutes.upcoming[locale]);
    await expect(
      page.getByRole("heading", { level: 2, name: copy.title })
    ).toBeVisible();
    await expect(page.getByText(copy.description)).toBeVisible();
    const contribute = page.getByRole("link", { name: copy.contribute });
    await expect(contribute).toBeVisible();
    await expect
      .poll(() =>
        contribute.evaluate((node) =>
          Object.keys(node).some((key) => key.startsWith("__reactProps$"))
        )
      )
      .toBe(true);
    expect(MutableList.toArray(missing)).toEqual([]);
  });
}
