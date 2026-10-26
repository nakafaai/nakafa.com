import { expect, test } from "@playwright/test";
import { Effect, Option } from "effect";
import {
  createSchool,
  hostAddress,
  seedForum,
  signInClassTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`the mention list opens at the caret, keeps the field's focus, and answers the arrow keys, Enter and Escape, at ${viewport.width} px`, async ({
    browser,
    baseURL,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInClassTeacher(context, school.slug, address("/"))
    );
    // A classmate placed in the class, whom the teacher may mention.
    const forum = await Effect.runPromise(seedForum(school.slug, 1, 1));
    const page = await context.newPage();
    await page.goto(
      address(`/classes/fisika-x-1/forum?channel=${forum.channelId}`)
    );
    const field = page.getByRole("textbox", { name: "Write a message" });
    await waitUntilTakenOver(field);
    await expect(page.getByText("Pesan 1", { exact: true })).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });

    // `@` opens the list, everyone first for a subject teacher, and the field keeps the focus.
    await field.click();
    await field.pressSequentially("Halo @");
    const list = page.getByRole("listbox", { name: "People to mention" });
    await expect(list).toBeVisible();
    await expect(field).toBeFocused();
    const options = list.getByRole("option");
    await expect(options).toHaveText(["Everyone in the class", "Raka Pratama"]);
    await expect(options.first()).toHaveAttribute("aria-selected", "true");

    // The list stays inside the viewport and never covers the line being typed.
    const box = Option.getOrThrow(Option.fromNullOr(await list.boundingBox()));
    const line = Option.getOrThrow(
      Option.fromNullOr(await field.boundingBox())
    );
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(line.y + 1);

    // The arrow keys move the active choice, and Enter puts the name in the text.
    await field.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await field.press("ArrowDown");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await field.press("ArrowUp");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await field.press("Enter");
    await expect(list).toBeHidden();
    await expect(field).toHaveValue("Halo @Raka Pratama ");
    await expect(field).toBeFocused();

    // Typed letters narrow the list, and Escape closes it without changing the text.
    await field.pressSequentially("dan @ev");
    await expect(options).toHaveText(["Everyone in the class"]);
    await field.press("Escape");
    await expect(list).toBeHidden();
    await expect(field).toHaveValue("Halo @Raka Pratama dan @ev");

    // The sent message shows the picked name as a mention.
    await field.fill("Halo @");
    await field.press("ArrowDown");
    await field.press("Tab");
    await field.press("Enter");
    const sent = page.locator("bdi", { hasText: "@Raka Pratama" });
    await expect(sent).toBeVisible();
    await page.reload();
    await expect(page.locator("bdi", { hasText: "@Raka Pratama" })).toBeVisible(
      { timeout: readinessTimeoutMilliseconds }
    );
    await context.close();
  });
}
