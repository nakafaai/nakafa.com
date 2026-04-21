import { expect, test } from "@playwright/test";
import {
  ensureTranscriptAtLatest,
  getFirstVisiblePostId,
  getPostTopWithinScrollRoot,
  openScenario,
  scrollTranscriptToMiddle,
  waitForConversationIdle,
  waitForTranscriptImages,
} from "@/playwright/forum-conversation.helpers";

async function closeAndReopenPanel(
  page: import("@playwright/test").Page,
  expectPostView = false
) {
  await page.getByTestId("control-close-panel").click();
  await expect(page.getByTestId("playwright-panel-closed")).toBeVisible();
  await page.getByTestId("control-open-panel").click();
  await expect(page.getByTestId("playwright-panel-open")).toBeVisible();
  await waitForConversationIdle(page);

  if (expectPostView) {
    await expect(page.getByTestId("runtime-settled-view")).toContainText(
      "post:"
    );
  }
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({
    reducedMotion: "reduce",
  });
});

test("refresh from middle restores the same semantic place", async ({
  page,
}) => {
  await openScenario(page, "long");
  await scrollTranscriptToMiddle(page);
  await expect(page.getByTestId("runtime-settled-view")).toContainText("post:");

  const beforeReload = await getFirstVisiblePostId(page);

  await page.reload();
  await expect(
    page.getByTestId("playwright-conversation-harness")
  ).toBeVisible();
  await waitForConversationIdle(page);

  await expect(page.getByTestId("runtime-settled-view")).toContainText("post:");
  await expect.poll(() => getFirstVisiblePostId(page)).toBe(beforeReload);
});

test("latest from middle reaches the true latest in one click", async ({
  page,
}) => {
  await openScenario(page, "long");
  await scrollTranscriptToMiddle(page);

  await expect(page.getByTestId("conversation-latest-button")).toBeVisible();
  await page.getByTestId("conversation-latest-button").click();
  await waitForConversationIdle(page);

  await expect(page.getByTestId("runtime-is-at-bottom")).toHaveText("true");
  await expect(page.getByTestId("runtime-is-at-latest-edge")).toHaveText(
    "true"
  );
  await expect(page.getByTestId("runtime-settled-view")).toHaveText("bottom");
  await expect(page.getByTestId("conversation-latest-button")).toBeHidden();
  await expect(page.locator('[data-post-id="forum_post_160"]')).toBeVisible();
});

test("latest stays pinned when new posts append", async ({ page }) => {
  await openScenario(page, "long");
  await ensureTranscriptAtLatest(page);

  await page.getByTestId("control-append-post").click();
  await waitForConversationIdle(page);

  await expect(page.getByTestId("runtime-is-at-bottom")).toHaveText("true");
  await expect(page.getByTestId("runtime-settled-view")).toHaveText("bottom");
  await expect(page.getByTestId("conversation-latest-button")).toBeHidden();
  await expect(page.locator('[data-post-id="forum_post_161"]')).toBeVisible();
});

test("reply preview jump creates real back history", async ({ page }) => {
  await openScenario(page, "long");

  await page.getByTestId("conversation-reply-indicator-forum_post_154").click();
  await waitForConversationIdle(page);

  await expect(page.getByTestId("runtime-can-go-back")).toHaveText("true");
  await expect(page.getByTestId("conversation-back-button")).toBeVisible();
  await expect(page.locator('[data-post-id="forum_post_118"]')).toBeVisible();
});

test("same-place jump does not create useless back history", async ({
  page,
}) => {
  await openScenario(page, "long");
  await scrollTranscriptToMiddle(page);

  await page.getByTestId("control-jump-settled").click();
  await waitForConversationIdle(page);

  await expect(page.getByTestId("runtime-can-go-back")).toHaveText("false");
  await expect(page.getByTestId("conversation-back-button")).toBeHidden();
});

test("back disappears once the captured origin is reached again", async ({
  page,
}) => {
  await openScenario(page, "long");
  await scrollTranscriptToMiddle(page);

  const originPostId = await getFirstVisiblePostId(page);

  await page.getByTestId("control-jump-target").click();
  await waitForConversationIdle(page);
  await expect(page.getByTestId("conversation-back-button")).toBeVisible();

  await page.getByTestId("conversation-back-button").click();
  await waitForConversationIdle(page);

  await expect(page.getByTestId("runtime-can-go-back")).toHaveText("false");
  await expect(page.getByTestId("conversation-back-button")).toBeHidden();
  await expect.poll(() => getFirstVisiblePostId(page)).toBe(originPostId);
});

test("prepending older history keeps the viewport anchored", async ({
  page,
}) => {
  await openScenario(page, "long");
  await expect(page.getByTestId("runtime-oldest-loaded-post-id")).toHaveText(
    "forum_post_136"
  );
  await page.getByTestId("virtual-conversation").evaluate((element) => {
    element.scrollTop = element.clientHeight + 20;
  });
  await page.waitForTimeout(500);

  const anchor = await page
    .getByTestId("virtual-conversation")
    .evaluate((element) => {
      element.scrollTop = Math.max(0, element.clientHeight - 20);

      const rootRect = element.getBoundingClientRect();

      for (const row of element.querySelectorAll<HTMLElement>(
        "[data-post-id]"
      )) {
        const rowRect = row.getBoundingClientRect();

        if (rowRect.bottom <= rootRect.top) {
          continue;
        }

        if (rowRect.top >= rootRect.bottom) {
          break;
        }

        const nextAnchor = {
          postId: row.dataset.postId,
          top: rowRect.top - rootRect.top,
        };

        element.dispatchEvent(new Event("scroll", { bubbles: true }));
        return nextAnchor;
      }

      element.dispatchEvent(new Event("scroll", { bubbles: true }));
      return null;
    });

  expect(anchor).not.toBeNull();
  await expect(page.getByTestId("runtime-oldest-loaded-post-id")).toHaveText(
    "forum_post_111"
  );

  await expect
    .poll(async () => {
      if (!(anchor?.postId && anchor.top !== null)) {
        return null;
      }

      const currentTop = await getPostTopWithinScrollRoot(page, anchor.postId);

      if (currentTop === null) {
        return null;
      }

      return Math.abs(currentTop - anchor.top);
    })
    .toBeLessThanOrEqual(1);
});

test("close and reopen from middle restores the same semantic place", async ({
  page,
}) => {
  await openScenario(page, "long");
  await scrollTranscriptToMiddle(page);
  await expect(page.getByTestId("runtime-saved-view")).toContainText(":");

  const beforeClose = await getFirstVisiblePostId(page);

  await closeAndReopenPanel(page, true);

  await expect.poll(() => getFirstVisiblePostId(page)).toBe(beforeClose);
});

test("image-heavy refresh restores without drifting to another anchor", async ({
  page,
}) => {
  await openScenario(page, "image");
  await scrollTranscriptToMiddle(page);
  await waitForTranscriptImages(page);

  const beforeReload = await getFirstVisiblePostId(page);

  await page.reload();
  await expect(
    page.getByTestId("playwright-conversation-harness")
  ).toBeVisible();
  await waitForTranscriptImages(page);

  await expect.poll(() => getFirstVisiblePostId(page)).toBe(beforeReload);
});

test("image-heavy close and reopen from bottom stays pinned to true latest", async ({
  page,
}) => {
  await openScenario(page, "image");
  await ensureTranscriptAtLatest(page);
  await waitForTranscriptImages(page);
  await expect(page.getByTestId("runtime-saved-view")).toHaveText("bottom");
  await expect(page.getByTestId("runtime-settled-view")).toHaveText("bottom");

  await closeAndReopenPanel(page);
  await waitForTranscriptImages(page);

  await expect(page.getByTestId("runtime-is-at-bottom")).toHaveText("true");
  await expect(page.getByTestId("runtime-saved-view")).toHaveText("bottom");
  await expect(page.getByTestId("runtime-settled-view")).toHaveText("bottom");
  await expect(page.getByTestId("conversation-latest-button")).toBeHidden();
});

test("image-heavy threads reach the real bottom in one latest click from the middle", async ({
  page,
}) => {
  await openScenario(page, "image");
  await scrollTranscriptToMiddle(page);

  await expect(page.getByTestId("conversation-latest-button")).toBeVisible();
  await page.getByTestId("conversation-latest-button").click();
  await waitForTranscriptImages(page);

  await expect(page.getByTestId("runtime-is-at-bottom")).toHaveText("true");
  await expect(page.getByTestId("runtime-settled-view")).toHaveText("bottom");
  await expect(page.getByTestId("conversation-latest-button")).toBeHidden();
});

test("short threads do not show useless back or latest controls", async ({
  page,
}) => {
  await openScenario(page, "short");

  await expect(page.getByTestId("conversation-back-button")).toBeHidden();
  await expect(page.getByTestId("conversation-latest-button")).toBeHidden();
  await expect(page.getByTestId("runtime-settled-view")).toHaveText("bottom");
});
