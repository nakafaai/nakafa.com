import { expect, type Locator, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, String as Str } from "effect";
import { pictureOf } from "@/e2e/support/attachment";
import { expectNoOverflow } from "@/e2e/support/layout";
import {
  createSchool,
  hostAddress,
  seedForum,
  signInClassTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The longest kind of name a school holds: a Javanese title, given names and two family names. */
const LONG_NAME =
  "Raden Ajeng Siti Nurhaliza Kusumawardhani Hadiningrat Wijayakusuma Putri Siregar";

/** A message as long as a teacher's instructions get: 2,000 characters of real sentences. */
const LONG_TEXT = Str.slice(
  0,
  2000
)(
  Arr.join(
    Arr.replicate(
      "Hari ini kita belajar tentang gaya gesek dan arah gerak benda, lalu mengerjakan latihan di buku paket. ",
      25
    ),
    ""
  )
);

/** An address shared from a phone, with no space to break at. */
const LONG_URL =
  "https://docs.google.com/document/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789abcdefghijklmnop/edit?usp=sharing&ouid=104857600123456789012";

/** One German compound, a word that no row is wide enough for. */
const LONG_WORD = "Donaudampfschifffahrtsgesellschaftskapitänsmützenabzeichen";

/** The leading bytes of a PDF, which is all the server reads of one. */
const PAPER = Buffer.from("%PDF-1.7\n1 0 obj\n");

/** A document name as a teacher's export writes it. */
const LONG_FILE =
  "Rangkuman-Materi-Bab-1-Bilangan-Bulat-dan-Pecahan-Kelas-VII-Semester-Ganjil-2026-final-revisi-3.pdf";

/**
 * The words a reader searches the twelve emoji of one message by. The chooser finds an emoji by its words in
 * Indonesian, English and German whichever the reader reads, so this English-reading teacher mixes all three, and each
 * word finds its emoji first.
 */
const REACTIONS = [
  "jempol",
  "red heart",
  "tertawa",
  "feuer",
  "bintang",
  "tepuk",
  "rakete",
  "piala",
  "buku",
  "centang",
  "light bulb",
  "pesta",
];

/** What a screenshot's name leaves out of the text it shows. */
const NON_WORD = /\W/gu;

/** How many replies the long thread holds. */
const THREAD_REPLIES = 200;

/** The widths the worst case is read at, the widest first. */
const WIDTHS = [1440, 768, 390, 320];

/** The row of the chat's message that reads `text`. */
const messageRow = (page: Page, text: string) =>
  page
    .getByRole("region", { name: "Messages" })
    .first()
    .locator("[data-slot=message]")
    .filter({ hasText: text });

/** Sends `text` from a composer and waits until the chat shows it. */
const send = async (page: Page, field: Locator, text: string) => {
  await field.fill(text);
  await field.press("Enter");
  await expect(field).toHaveValue("");
  await expect(messageRow(page, Str.slice(0, 40)(text)).first()).toBeVisible();
};

/**
 * Asserts that every bubble, every document card and every name stays inside the chat's column, and that no text
 * leaves its card: what a long word, a long name or a long file name breaks first.
 */
const expectContained = (page: Page, label: string) =>
  page.evaluate((where) => {
    const log = document.querySelector("[role=log]");
    if (log === null) {
      throw new Error(`${where}: no chat`);
    }
    const column = log.getBoundingClientRect();
    const outside = Array.from(
      log.querySelectorAll(
        "[data-slot=bubble], [data-slot=attachment], [data-slot=message-header], [data-slot=item]"
      )
    ).filter((element) => {
      const box = element.getBoundingClientRect();
      return box.left < column.left - 0.5 || box.right > column.right + 0.5;
    });
    const spilled = Array.from(
      log.querySelectorAll("[data-slot=attachment-title]")
    ).filter((title) => {
      const card = title.closest("[data-slot=attachment]");
      return (
        card !== null &&
        title.getBoundingClientRect().right >
          card.getBoundingClientRect().right - 12 + 0.5
      );
    });
    return {
      outside: outside.map((element) => element.getAttribute("data-slot")),
      spilled: spilled.length,
    };
  }, label);

test("the forum holds the worst a class writes: a long name, long words, 2,000 characters, emoji alone, twelve reactions, ten files, 500 messages and a thread of 200 replies, from 1440 to 320 px", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(900_000);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(
    signInClassTeacher(context, school.slug, address("/"))
  );
  // Five hundred messages from three classmates, the newest hundred from the one with the longest name.
  const forum = await Effect.runPromise(seedForum(school.slug, 200, 200));
  await Effect.runPromise(seedForum(school.slug, 200, 200));
  await Effect.runPromise(seedForum(school.slug, 100, 100, LONG_NAME));
  const page = await context.newPage();
  const channel = address(
    `/classes/fisika-x-1/forum?channel=${forum.channelId}`
  );
  await page.goto(channel);
  await expect(messageRow(page, "Pesan 100").first()).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  const field = page.getByRole("textbox", { name: "Write a message" });

  // Long text, an address and a compound with no space, and emoji alone.
  await send(page, field, LONG_TEXT);
  await send(page, field, LONG_URL);
  await send(page, field, LONG_WORD);
  await field.fill("🎉🎉🎉");
  await field.press("Enter");
  await expect(field).toHaveValue("");

  // Ten files on two messages: eight documents, the first with a long name, then a tall and a wide photo.
  const add = page.getByRole("button", {
    name: "Add a photo, a document or a poll",
  });
  const sendButton = page.getByRole("button", { exact: true, name: "Send" });
  const chooseDocuments = page.waitForEvent("filechooser");
  await add.click();
  await page.getByRole("menuitem", { name: "Document" }).click();
  await (await chooseDocuments).setFiles(
    Arr.map(Arr.range(1, 8), (index) => ({
      buffer: PAPER,
      mimeType: "application/pdf",
      name: index === 1 ? LONG_FILE : `Latihan-${index}.pdf`,
    }))
  );
  await expect(sendButton).toBeEnabled({
    timeout: readinessTimeoutMilliseconds,
  });
  await sendButton.click();
  await expect(
    page.getByRole("link", { name: `Open ${LONG_FILE}` })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  const tall = await Effect.runPromise(
    pictureOf(page, "struk-panjang.png", { height: 1200, width: 60 })
  );
  const wide = await Effect.runPromise(
    pictureOf(page, "panorama.png", { height: 160, width: 1600 })
  );
  const choosePhotos = page.waitForEvent("filechooser");
  await add.click();
  await page.getByRole("menuitem", { name: "Photo" }).click();
  await (await choosePhotos).setFiles([tall, wide]);
  await expect(sendButton).toBeEnabled({
    timeout: readinessTimeoutMilliseconds,
  });
  await sendButton.click();
  await expect(
    page.getByRole("button", { name: "Open panorama.png" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  // Twelve reactions on one message, each found in the chooser by a word in one of the three languages.
  const target = messageRow(page, Str.slice(0, 40)(LONG_URL)).first();
  for (const word of REACTIONS) {
    await target.hover();
    await target.getByRole("button", { name: "React" }).click();
    const search = page.getByRole("searchbox", { name: "Search emoji" });
    await search.fill(word);
    await search.press("Enter");
    await expect(search).toBeHidden();
  }
  await expect(target.locator("button[aria-pressed=true]")).toHaveCount(
    REACTIONS.length,
    { timeout: readinessTimeoutMilliseconds }
  );

  // Two tabs send at once, as two people typing together do, and both messages land in both tabs.
  const second = await context.newPage();
  await second.goto(channel);
  const secondField = second.getByRole("textbox", { name: "Write a message" });
  await expect(secondField).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await field.fill("Dari tab pertama.");
  await secondField.fill("Dari tab kedua.");
  await Promise.all([field.press("Enter"), secondField.press("Enter")]);
  for (const tab of [page, second]) {
    await expect(messageRow(tab, "Dari tab pertama.")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(messageRow(tab, "Dari tab kedua.")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
  }
  await second.close();

  // Offline, a message shows at once and goes out when the network is back; a slow network changes nothing.
  await context.setOffline(true);
  await send(page, field, "Terkirim saat jaringan kembali.");
  await context.setOffline(false);
  // The message's controls wait, pressed by nobody, until the server holds it.
  await expect(
    messageRow(page, "Terkirim saat jaringan kembali.").getByRole("button", {
      name: "React",
    })
  ).toBeEnabled({ timeout: readinessTimeoutMilliseconds });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.emulateNetworkConditions", {
    downloadThroughput: 50_000,
    latency: 400,
    offline: false,
    uploadThroughput: 50_000,
  });
  await page.reload();
  await expect(messageRow(page, "Terkirim saat jaringan kembali.")).toBeVisible(
    { timeout: readinessTimeoutMilliseconds }
  );
  await cdp.send("Network.emulateNetworkConditions", {
    downloadThroughput: -1,
    latency: 0,
    offline: false,
    uploadThroughput: -1,
  });

  // A thread of 200 replies, its summary counting them under the message.
  const root = messageRow(page, "Pesan 100").first();
  await root.hover();
  await root.getByRole("button", { name: "Reply in thread" }).click();
  const pane = page.locator("[data-slot=discussion]");
  const reply = pane.getByRole("textbox", { name: "Write a reply" });
  for (const index of Arr.range(1, THREAD_REPLIES)) {
    await reply.fill(`Balasan ${index}`);
    await reply.press("Enter");
  }
  await expect(
    pane.getByText(`Balasan ${THREAD_REPLIES}`, { exact: true })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await page.getByRole("button", { exact: true, name: "Close" }).click();
  await expect(
    root.getByRole("link", {
      name: new RegExp(`^${THREAD_REPLIES} replies`, "u"),
    })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  // Every width keeps the page inside the window and every message inside its column.
  for (const width of WIDTHS) {
    await page.setViewportSize({ height: width < 768 ? 844 : 900, width });
    await Effect.runPromise(expectNoOverflow(page, `chat at ${width}`));
    for (const shown of [
      LONG_NAME,
      LONG_TEXT,
      LONG_URL,
      LONG_FILE,
      "panorama.png",
      "Pesan 100",
    ]) {
      await page
        .getByText(Str.slice(0, 40)(shown))
        .first()
        .scrollIntoViewIfNeeded();
      expect(await expectContained(page, `${shown} at ${width}`)).toEqual({
        outside: [],
        spilled: 0,
      });
      await page.screenshot({
        path: info.outputPath(
          `edges-${Str.replace(NON_WORD, "")(Str.slice(0, 12)(shown))}-${width}.png`
        ),
      });
    }
  }
  await context.close();
});
