import { expect, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import {
  createSchool,
  hostAddress,
  seedForum,
  signInClassTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of a channel of the seeded class, as its list links it. */
const CHANNEL_PATH = /\/classes\/fisika-x-1\/forum\?channel=/;

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`a teacher writes in the class's general channel, finds the message after a reload, edits it and hides it, at ${viewport.width} px`, async ({
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
    const page = await context.newPage();
    await page.goto(address("/classes/fisika-x-1/forum"));

    // The forum lists its channels, and the general channel opens its messages.
    const general = page.getByRole("link", { name: "General", exact: true });
    await waitUntilTakenOver(general);
    await general.click();
    await page.waitForURL(CHANNEL_PATH);
    await expect(
      page.getByRole("navigation", { name: "breadcrumb" })
    ).toContainText("General");
    await expect(page.getByText("No message yet")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });

    // A sent message shows at once, at the end of the channel, and the field empties.
    const field = page.getByRole("textbox", { name: "Write a message" });
    await field.fill("Tugas bab 3 dikumpulkan hari Jumat.");
    await field.press("Enter");
    await expect(
      page.getByText("Tugas bab 3 dikumpulkan hari Jumat.")
    ).toBeVisible();
    await expect(field).toHaveValue("");
    // The message keeps its row when the server answers, so its menu opens right away.
    await page.getByRole("button", { name: "More actions" }).click();
    await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await page.keyboard.press("Escape");

    // The server holds it, so the channel opened again shows it.
    await page.reload();
    const message = page.getByText("Tugas bab 3 dikumpulkan hari Jumat.");
    await expect(message).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });

    // The author edits the message in its place.
    await waitUntilTakenOver(
      page.getByRole("button", { name: "More actions" })
    );
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const editor = page.getByRole("textbox", { name: "Edit" });
    await editor.fill("Tugas bab 3 dikumpulkan hari Sabtu.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByText("Tugas bab 3 dikumpulkan hari Sabtu.")
    ).toBeVisible();
    await expect(page.getByText("Edited")).toBeVisible();

    // A subject teacher hides a message for good: it keeps its place with no text.
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Hide" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Hide", exact: true })
      .click();
    await expect(page.getByText("A teacher hid this message.")).toBeVisible();
    await expect(
      page.getByText("Tugas bab 3 dikumpulkan hari Sabtu.")
    ).toHaveCount(0);
    await context.close();
  });
}

/**
 * What React writes into the server's HTML when a part of the page threw while the server rendered
 * it and the browser has to render it again: the definition of its client-render instruction, and
 * the instruction itself.
 */
const SERVER_RENDER_FAILED = ["$RX=function", '$RX("'];

test("every class page that reads the class's channels renders on the server and in the browser, without an error state or a page error", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(
    signInClassTeacher(context, school.slug, address("/"))
  );
  const forum = await Effect.runPromise(seedForum(school.slug, 1, 1));
  const channel = `/classes/fisika-x-1/forum?channel=${forum.channelId}`;

  // A discussion in the general channel, so its page, which shows the channel beside it, is read too.
  const page = await context.newPage();
  const errors = MutableList.make<string>();
  page.on("pageerror", (error) => MutableList.append(errors, String(error)));
  await page.goto(address(channel));
  const start = page.getByRole("button", { name: "New discussion" });
  await waitUntilTakenOver(start);
  await start.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Title" }).fill("Gaya gesek");
  await dialog
    .getByRole("textbox", { name: "First message" })
    .fill("Tuliskan contohnya di sini.");
  await dialog.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("link", { name: "#1 Gaya gesek" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });

  // The pages of the class, each with what its server HTML must show: the forum lists the
  // channels, and a channel or a discussion names the channel in its path.
  const pages = [
    { path: "/classes/fisika-x-1", shows: ">Fisika X-1<" },
    { path: "/classes/fisika-x-1/forum", shows: ">General<" },
    { path: channel, shows: ">General<" },
    { path: "/classes/fisika-x-1/forum/1", shows: ">General<" },
    { path: "/classes/fisika-x-1/library", shows: ">Fisika X-1<" },
    { path: "/classes/fisika-x-1/tasks", shows: ">Fisika X-1<" },
  ];
  for (const { path, shows } of pages) {
    const served = await context.request.get(address(path));
    expect(served.status(), path).toBe(200);
    const html = await served.text();
    expect(html, path).toContain(shows);
    for (const marker of SERVER_RENDER_FAILED) {
      expect(html, path).not.toContain(marker);
    }

    await page.goto(address(path));
    await waitUntilTakenOver(
      page
        .getByRole("navigation", { name: "Class" })
        .getByRole("link", { name: "Forum" })
    );
    await expect(page.getByRole("main").getByRole("alert"), path).toHaveCount(
      0
    );
  }
  expect(MutableList.toArray(errors)).toEqual([]);
  await context.close();
});
