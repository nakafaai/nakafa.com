import { expect, test } from "@playwright/test";
import { Clock, Effect } from "effect";
import { CHAT_PATH, openChatPage, runOnPage } from "@/e2e/support/chat";
import { answerMessage, learnerMessage } from "@/e2e/support/prose";
import { openServedChat } from "@/e2e/support/serve";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The words of the page for a thought, by language: while it runs, after a second, after two, and a saved one. */
const LANGUAGES = [
  {
    locale: "en",
    one: "Thought for 1 second",
    saved: "Thought for a few seconds",
    thinking: "Thinking...",
    two: "Thought for 2 seconds",
  },
  {
    locale: "de",
    one: "1 Sekunde nachgedacht",
    saved: "Einige Sekunden nachgedacht",
    thinking: "Denkt nach...",
    two: "2 Sekunden nachgedacht",
  },
  {
    locale: "id",
    one: "Berpikir selama 1 detik",
    saved: "Berpikir selama beberapa detik",
    thinking: "Berpikir...",
    two: "Berpikir selama 2 detik",
  },
];

/** Chunks that open a thought, as the model writes them. */
const startThinking = (id: string) => [
  { id, type: "reasoning-start" },
  { delta: "Aku pikir dulu.", id, type: "reasoning-delta" },
];

test.describe("A thought in the language of the page", () => {
  test.use({ viewport: { height: 900, width: 390 } });
  test.describe.configure({ timeout: 180_000 });

  for (const language of LANGUAGES) {
    test(`counts its seconds in ${language.locale}`, async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => page.clock.install());
          const served = yield* openServedChat(
            page,
            origin,
            [
              learnerMessage({ order: 1, text: "Apa itu turunan?" }),
              answerMessage({
                markdown: "Turunan adalah laju perubahan.",
                order: 1,
                reasoning: "Aku pikir dulu.",
              }),
              learnerMessage({ order: 2, text: "Jelaskan lagi." }),
            ],
            language.locale
          );
          const start = yield* Clock.currentTimeMillis;

          yield* Effect.promise(async () => {
            // A thought that was saved has no clock, and says so.
            await expect.soft(page.getByText(language.saved)).toBeVisible();

            // The page counts a thought by its own clock, which stands still
            // at each step here: the seconds are the ones the test sets,
            // however long the page takes to draw.
            const thinksFor = async (id: string, begin: number, ms: number) => {
              await page.clock.setFixedTime(begin);
              served.push(startThinking(id));
              await expect(
                page.getByText(language.thinking, { exact: true })
              ).toBeVisible();
              await page.clock.setFixedTime(begin + ms);
              served.push([{ id, type: "reasoning-end" }]);
            };

            // A thought that ends within the second is one second long, not "1 seconds".
            served.begin(2);
            served.push([{ type: "start" }, { type: "start-step" }]);
            await thinksFor("first", start, 500);
            await expect
              .soft(page.getByText(language.one, { exact: true }))
              .toBeVisible();

            // A thought of more than a second and less than two lasts two.
            await thinksFor("second", start + 1000, 1200);
            await expect
              .soft(page.getByText(language.two, { exact: true }))
              .toBeVisible();
          });
        })
      );
    });
  }
});

test.describe("The dots before an answer", () => {
  test.use({ viewport: { height: 900, width: 390 } });
  test.describe.configure({ timeout: 180_000 });

  test("say their hidden words in German", async ({ baseURL, page }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes } = yield* openChatPage(page, origin);

        yield* Effect.promise(async () => {
          await page.goto(CHAT_PATH.replace("/en/", "/de/"));
          const composer = page.getByRole("textbox", {
            name: "Frag Nina etwas...",
          });

          await composer.fill("Was ist eine Ableitung?");
          await expect(
            page.getByRole("button", { name: "Nachricht senden" })
          ).toBeEnabled({ timeout: readinessTimeoutMilliseconds });
          // The server's answers wait, so the dots stay on the screen.
          changes.hold();
          await composer.press("Enter");
          await expect(
            page.getByText("Wird geladen", { exact: true })
          ).toBeVisible();
          changes.release();
        });
      })
    );
  });
});
