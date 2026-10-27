import { expect, test } from "@playwright/test";
import { Array as Arr, MutableList } from "effect";
import { seedRawStorage } from "@/e2e/support/consent";
import { SIGNED_IN_HINT_COOKIE } from "@/lib/auth/hint";
import { KNOWN_SESSION_KEY } from "@/lib/auth/keys";
import { TOKEN_PATH } from "@/lib/auth/session";

/** The id of a session the browser remembers, which the server no longer holds. */
const ENDED_SESSION = "ended-session";
/**
 * The learner's home, which reads Convex as soon as it loads, so it asks for the
 * remembered session's token at once.
 */
const HOME = "/en/home";

/**
 * A browser that still holds the signed-in hint and the id of a session that
 * has ended asks for that session's Convex token as the page loads. The token
 * route answers that no session holds a token, so the browser fetches no 401
 * and the console stays empty while the page settles signed out.
 */
test("the learner home of a remembered session that has ended loads with no console error", async ({
  baseURL,
  context,
  page,
}) => {
  const errors = MutableList.make<string>();
  const tokenAnswers = MutableList.make<number>();
  page.on("console", (message) => {
    if (message.type() === "error") {
      MutableList.append(errors, message.text());
    }
  });
  page.on("pageerror", (error) => MutableList.append(errors, String(error)));
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === TOKEN_PATH) {
      MutableList.append(tokenAnswers, response.status());
    }
  });
  await context.addCookies([
    {
      name: SIGNED_IN_HINT_COOKIE,
      sameSite: "Lax",
      url: String(baseURL),
      value: "1",
    },
  ]);
  await seedRawStorage(page, KNOWN_SESSION_KEY, ENDED_SESSION);

  const tokenRead = page.waitForResponse(
    (response) => new URL(response.url()).pathname === TOKEN_PATH
  );
  await page.goto(HOME);
  expect(await (await tokenRead).json()).toStrictEqual({ token: null });
  await page.waitForLoadState("networkidle");

  expect(MutableList.toArray(tokenAnswers).length).toBeGreaterThan(0);
  expect(
    Arr.filter(MutableList.toArray(tokenAnswers), (status) => status !== 200)
  ).toEqual([]);
  expect(MutableList.toArray(errors)).toEqual([]);
});
