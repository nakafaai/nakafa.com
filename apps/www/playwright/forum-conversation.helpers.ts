import { expect, type Page } from "@playwright/test";

const routePath = "/en/playwright/forum-conversation";

function getSessionKey(scenario: string) {
  return `forum-ui:playwright-forum-${scenario}`;
}

/** Opens one deterministic browser scenario from a clean same-tab session. */
export async function openScenario(page: Page, scenario: string) {
  await page.goto(`${routePath}?scenario=${scenario}`);
  await page.evaluate((key) => {
    sessionStorage.removeItem(key);
  }, getSessionKey(scenario));
  await page.reload();
  await expect(
    page.getByTestId("playwright-conversation-harness")
  ).toBeVisible();
  await expect(page.getByTestId("runtime-settled-view")).not.toHaveText("null");
  await waitForConversationIdle(page);
}

/** Waits until the runtime has no pending scroll or highlight work left. */
export async function waitForConversationIdle(page: Page) {
  await expect(page.getByTestId("runtime-scroll-request-kind")).toHaveText(
    "null"
  );
  await expect(
    page.getByTestId("runtime-pending-highlight-post-id")
  ).toHaveText("null");
}

/** Waits until every transcript image has finished loading and resize settles again. */
export async function waitForTranscriptImages(page: Page) {
  await expect
    .poll(() =>
      page
        .getByTestId("virtual-conversation")
        .evaluate((scrollElement) =>
          Array.from(scrollElement.querySelectorAll("img")).every(
            (image) => image.complete
          )
        )
    )
    .toBe(true);
  await waitForConversationIdle(page);
}

/** Makes sure the transcript is truly pinned to the latest bottom edge. */
export async function ensureTranscriptAtLatest(page: Page) {
  const latestButton = page.getByTestId("conversation-latest-button");

  if (await latestButton.isVisible()) {
    await latestButton.click();
  }

  await waitForConversationIdle(page);
  await expect(page.getByTestId("runtime-is-at-bottom")).toHaveText("true");
  await expect(page.getByTestId("runtime-settled-view")).toHaveText("bottom");
}

/** Scrolls the transcript viewport to a deterministic middle position. */
export async function scrollTranscriptToMiddle(page: Page) {
  const transcript = page.getByTestId("virtual-conversation");

  await transcript.evaluate((element) => {
    element.scrollTop = Math.max(
      1,
      (element.scrollHeight - element.clientHeight) / 2
    );
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.waitForTimeout(250);

  await expect(page.getByTestId("runtime-settled-view")).toContainText("post:");
  await expect
    .poll(async () => {
      const firstVisiblePostId = await getFirstVisiblePostId(page);
      const settledView = await page
        .getByTestId("runtime-settled-view")
        .textContent();

      if (!(firstVisiblePostId && settledView?.startsWith("post:"))) {
        return false;
      }

      return settledView.split(":")[1] === firstVisiblePostId;
    })
    .toBe(true);
}

/** Reads one post's visual top offset inside the transcript scroll root. */
export function getPostTopWithinScrollRoot(page: Page, postId: string) {
  return page
    .getByTestId("virtual-conversation")
    .evaluate((scrollElement, targetPostId) => {
      const row = scrollElement.querySelector<HTMLElement>(
        `[data-post-id="${targetPostId}"]`
      );

      if (!row) {
        return null;
      }

      return (
        row.getBoundingClientRect().top -
        scrollElement.getBoundingClientRect().top
      );
    }, postId);
}

/** Returns the first transcript post currently visible inside the scroll root. */
export function getFirstVisiblePostId(page: Page) {
  return page.getByTestId("virtual-conversation").evaluate((scrollElement) => {
    const rootRect = scrollElement.getBoundingClientRect();

    for (const row of scrollElement.querySelectorAll<HTMLElement>(
      "[data-post-id]"
    )) {
      const rowRect = row.getBoundingClientRect();

      if (rowRect.bottom <= rootRect.top) {
        continue;
      }

      if (rowRect.top >= rootRect.bottom) {
        break;
      }

      return row.dataset.postId ?? null;
    }

    return null;
  });
}
