import { expect, type Locator } from "@playwright/test";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Option, Schema, String as Str } from "effect";
import { waitUntilTakenOver } from "@/e2e/support/window";
import { schoolSettingsGroups } from "@/lib/settings/school";

/** The school settings groups in sidebar order. No path is read here, so any school stands in. */
const GROUPS = schoolSettingsGroups(Schema.decodeSync(TenantSlug)("sekolah"));

/** A section of the school settings, by the key of its label. */
type SettingsSection = (typeof GROUPS)[number]["sections"][number]["labelKey"];

/** The start of the settings sidebar's first link, the way back to the school. */
const BACK = Arr.headNonEmpty(
  Str.split(en.SchoolSettings["back-to-school"], "{school}")
);

/**
 * Waits until React owns the settings sidebar that shows, whose first link is the way
 * back to the school. The school's own groups stay mounted but hidden beside it, and
 * until React owns the settings groups a press on one opens nothing.
 */
const waitForSidebar = (sidebar: Locator) =>
  waitUntilTakenOver(sidebar.getByRole("link").filter({ hasText: BACK }));

/** Opens one settings group in the sidebar, unless it is open already. */
async function openGroup(fold: Locator) {
  if ((await fold.getAttribute("aria-expanded")) !== "true") {
    await fold.click();
  }
  await expect(fold).toHaveAttribute("aria-expanded", "true");
}

/**
 * The link of a settings section in the school's settings sidebar. Every group
 * but the school's own folds its sections under its name, and opens by itself
 * only while it holds the page on screen, so the section's group opens first.
 */
export async function settingsLink(sidebar: Locator, section: SettingsSection) {
  const group = Option.getOrThrow(
    Arr.findFirst(GROUPS, (candidate) =>
      Arr.some(candidate.sections, (entry) => entry.labelKey === section)
    )
  );
  await waitForSidebar(sidebar);
  if (group.key !== "school") {
    await openGroup(
      sidebar.getByRole("button", {
        exact: true,
        name: en.SchoolSettings[group.key],
      })
    );
  }
  const link = sidebar.getByRole("link", {
    exact: true,
    name: en.SchoolSettings[section],
  });
  await expect(link).toBeVisible();
  return link;
}

/** Opens every folded settings group the viewer has, so each section the viewer may open shows its link. */
export async function openEverySettingsGroup(sidebar: Locator) {
  await waitForSidebar(sidebar);
  for (const group of GROUPS) {
    if (group.key === "school") {
      continue;
    }
    const fold = sidebar.getByRole("button", {
      exact: true,
      name: en.SchoolSettings[group.key],
    });
    if ((await fold.count()) > 0) {
      await openGroup(fold);
    }
  }
}
