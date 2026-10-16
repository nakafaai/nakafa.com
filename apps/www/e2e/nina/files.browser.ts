import { expect, type Locator, test } from "@playwright/test";
import {
  NINA_FILE_COUNT,
  NINA_FILE_MEBIBYTES,
  NINA_FILE_SIZE,
  NINA_FILENAME_LENGTH,
} from "@repo/backend/client/nina/uploads";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect } from "effect";
import {
  chipsIn,
  fileOf,
  NOT_ATTACHED,
  NOTICE_LIST,
  noticeWith,
  openComposer,
  photo,
  pickFiles,
  runPage,
  WORD_TYPE,
} from "@/e2e/support/attachment";
import { waitForSlide } from "@/e2e/support/layout";

/** The reasons a notice gives, as the English site words them. */
const REJECTIONS = en.Ai["attachment-rejections"];
const TYPES = REJECTIONS.type;
const LARGER = REJECTIONS.size.replace(
  "{size, number}",
  String(NINA_FILE_MEBIBYTES)
);
const MANY = REJECTIONS.count.replace(
  "{count, number}",
  String(NINA_FILE_COUNT)
);

/** The part of a notice that gives one reason, with the files it dropped. */
const reasonIn = (notice: Locator, reason: string) =>
  notice.locator("dl > div").filter({ hasText: reason });

/**
 * Whether a notice lies inside the page, every name in it fits its line and
 * keeps its end in view, read in the page.
 */
const readNotice = (notice: HTMLElement) => {
  const box = notice.getBoundingClientRect();
  // The files of every reason are the descriptions of one list, and each name
  // is a start that gives way and an end that stays.
  const names = Array.from(notice.querySelectorAll("dd"));
  return {
    endsShown: names.every((name) => {
      const end = name.lastElementChild;
      return end !== null && end.scrollWidth <= end.clientWidth;
    }),
    inside: box.left >= 0 && box.right <= innerWidth,
    namesFit: names.every((name) => name.scrollWidth <= name.clientWidth),
    namesShown: names.length,
  };
};

/**
 * The names that the reason at the top of the list covers in part, read in the
 * page. A reason hides a name whole when the name lies within its box, which is
 * the way a name goes under it. A name that sticks out of its box is cut in
 * half, and a learner sees half a name under the reason.
 */
const readCutNames = (notice: HTMLElement, scroller: string) => {
  const list = notice.querySelector(scroller);
  if (!list) {
    return null;
  }
  const top = list.getBoundingClientRect().top;
  // The reason that stays is the one whose box starts at the top of the list.
  const reason = Array.from(notice.querySelectorAll("dt")).find(
    (candidate) => Math.abs(candidate.getBoundingClientRect().top - top) < 0.5
  );
  if (!reason) {
    return [];
  }
  const covered = reason.getBoundingClientRect();
  return Array.from(notice.querySelectorAll("dd"))
    .filter((name) => {
      const box = name.getBoundingClientRect();
      const overlap =
        Math.min(box.bottom, covered.bottom) - Math.max(box.top, covered.top);
      const within =
        box.top >= covered.top - 0.5 && box.bottom <= covered.bottom + 0.5;
      return overlap > 0.5 && !within;
    })
    .map((name) => name.textContent);
};

/**
 * Scrolls the list to the middle of a line, a place that a scroll of the wheel
 * leaves a plain list at, and returns the height of a line.
 */
const scrollBetweenLines = (notice: HTMLElement, scroller: string) => {
  const list = notice.querySelector(scroller);
  const name = notice.querySelector("dd");
  if (!(list && name)) {
    return null;
  }
  const line = Number.parseFloat(getComputedStyle(name).lineHeight);
  list.scrollTop = line * 5.5;
  return line;
};

/**
 * Which edges of the list fade, read in the page from the mask of its scroll
 * area. The end fades by a length while more follows, and the length is gone at
 * the end of the list. The start never fades, because the reason that stays
 * there would fade with it. A browser lists the stops of a fade by their
 * position: `calc(100% - 24px)` is a fade of 24 pixels.
 */
const readFade = (notice: HTMLElement, scroller: string) => {
  const list = notice.querySelector(scroller);
  if (!list) {
    return null;
  }
  const mask = getComputedStyle(list).maskImage;
  return {
    endFades: mask.includes("calc(100% - "),
    startFades: mask.includes("to top, rgb(0, 0, 0) calc("),
  };
};

/**
 * Whether a notice with a long list lies inside the page, shows the reason of
 * the first group at rest, and shows the reason of the last group, with every
 * name below it whole, once the list is scrolled to its end, read in the page.
 * The read scrolls the list, so it comes last.
 */
const readList = (notice: HTMLElement, scroller: string) => {
  const list = notice.querySelector(scroller);
  const reasons = Array.from(notice.querySelectorAll("dt"));
  const [first] = reasons;
  const last = reasons.at(-1);
  const lastName = Array.from(notice.querySelectorAll("dd")).at(-1);
  if (!(list && first && last && lastName)) {
    return null;
  }
  const box = notice.getBoundingClientRect();
  const inList = (element: Element) => {
    const bounds = list.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return rect.top >= bounds.top - 0.5 && rect.bottom <= bounds.bottom + 0.5;
  };
  // Back at the top, where the list rests before anyone scrolls it.
  list.scrollTop = 0;
  const atRest = {
    firstReasonShown: inList(first),
    scrolls: list.scrollHeight > list.clientHeight,
  };
  list.scrollTop = list.scrollHeight;
  const stuck = last.getBoundingClientRect();
  return {
    ...atRest,
    firstReasonGone: !inList(first),
    inside:
      box.top >= 0 &&
      box.bottom <= innerHeight &&
      box.left >= 0 &&
      box.right <= innerWidth,
    lastNameReachable: inList(lastName),
    lastReasonShown: inList(last),
    // The reason is a box a name goes under, so the reader sees it on top of
    // the names and on the background of the notice, and nothing shows through.
    reasonOnTop: last.contains(
      document.elementFromPoint(
        stuck.left + stuck.width / 2,
        stuck.top + stuck.height / 2
      )
    ),
    reasonOpaque: getComputedStyle(last).backgroundColor !== "rgba(0, 0, 0, 0)",
  };
};

for (const width of [320, 1440]) {
  test.describe(`Choosing files at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    test("names every file Nina did not take, with its reason", async ({
      page,
    }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          const composer = yield* openComposer(page);
          yield* pickFiles(composer, [
            photo("lesson.png"),
            fileOf("essay.docx", WORD_TYPE, 20),
            fileOf("report.pdf", "application/pdf", NINA_FILE_SIZE + 1),
            fileOf("empty.txt", "text/plain", 0),
          ]);

          // The photo is the only file attached. One notice names the other
          // three, each with the reason it was not attached.
          yield* Effect.promise(async () => {
            await expect(chipsIn(composer)).toHaveCount(1);
            const notice = noticeWith(page, NOT_ATTACHED);
            await expect(notice).toHaveCount(1);
            // The title says nothing of how many files: the names show it.
            await expect(notice.locator("[data-title]")).toHaveText(
              NOT_ATTACHED
            );
            await expect(reasonIn(notice, TYPES)).toContainText("essay.docx");
            await expect(reasonIn(notice, LARGER)).toContainText("report.pdf");
            await expect(reasonIn(notice, REJECTIONS.empty)).toContainText(
              "empty.txt"
            );
            await expect(reasonIn(notice, TYPES)).not.toContainText(
              "report.pdf"
            );
          });
        })
      );
    });

    test("names the files that do not fit the count", async ({ page }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          const composer = yield* openComposer(page);
          const surplus = ["last-1.png", "last-2.png"];
          yield* pickFiles(composer, [
            ...Arr.makeBy(NINA_FILE_COUNT, (index) =>
              photo(`photo-${index + 1}.png`)
            ),
            ...Arr.map(surplus, photo),
          ]);

          yield* Effect.promise(async () => {
            await expect(chipsIn(composer)).toHaveCount(NINA_FILE_COUNT);
            const reason = reasonIn(noticeWith(page, NOT_ATTACHED), MANY);
            await expect(reason).toContainText("last-1.png");
            await expect(reason).toContainText("last-2.png");
          });
        })
      );
    });

    test("names every file of a long pick, keeps the reason of the group in view as the list scrolls, and stays inside the page", async ({
      page,
    }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          const composer = yield* openComposer(page);
          // A file of a type Nina does not read, then far more files than a
          // notice shows without scrolling: two reasons, and the last is long.
          const surplus = Arr.makeBy(25, (index) => `extra-${index + 1}.png`);
          yield* pickFiles(composer, [
            fileOf("essay.docx", WORD_TYPE, 20),
            ...Arr.makeBy(NINA_FILE_COUNT, (index) =>
              photo(`photo-${index + 1}.png`)
            ),
            ...Arr.map(surplus, photo),
          ]);
          const notice = noticeWith(page, NOT_ATTACHED);
          // The notice slides into place; its place is read once it stopped.
          yield* Effect.promise(async () => {
            await expect(chipsIn(composer)).toHaveCount(NINA_FILE_COUNT);
            await expect(notice).toHaveAttribute("data-mounted", "true");
          });
          yield* waitForSlide(notice);

          // Every file that was dropped has a line, and none counts them. At
          // rest the end of the list fades, which tells the learner that the
          // list goes on, and the start does not.
          yield* Effect.promise(async () => {
            await expect(notice.locator("dd")).toHaveCount(surplus.length + 1);
            await expect
              .poll(() => notice.evaluate(readFade, NOTICE_LIST))
              .toEqual({ endFades: true, startFades: false });
          });

          // Wherever a scroll leaves the list, a whole name is under the reason.
          yield* Effect.promise(async () => {
            await notice.evaluate(scrollBetweenLines, NOTICE_LIST);
            await expect
              .poll(() => notice.evaluate(readCutNames, NOTICE_LIST))
              .toEqual([]);
          });

          // At the end the reason of the last group stays at the top, and the
          // reason of the first has gone with its group. No name is cut under
          // it, and the last name can be reached.
          const read = yield* Effect.promise(() =>
            notice.evaluate(readList, NOTICE_LIST)
          );
          yield* Effect.promise(async () => {
            await expect
              .poll(() => notice.evaluate(readCutNames, NOTICE_LIST))
              .toEqual([]);
            // Nothing follows now, so the end does not fade, and the start
            // still does not, though the list is scrolled.
            await expect
              .poll(() => notice.evaluate(readFade, NOTICE_LIST))
              .toEqual({ endFades: false, startFades: false });
          });
          yield* Effect.sync(() => {
            expect(read).toEqual({
              firstReasonGone: true,
              firstReasonShown: true,
              inside: true,
              lastNameReachable: true,
              lastReasonShown: true,
              reasonOnTop: true,
              reasonOpaque: true,
              scrolls: true,
            });
          });
        })
      );
    });

    test("keeps a notice inside the page when a name is the longest the backend stores", async ({
      page,
    }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          const composer = yield* openComposer(page);
          const name = `${"a".repeat(NINA_FILENAME_LENGTH - ".docx".length)}.docx`;
          yield* pickFiles(composer, [fileOf(name, WORD_TYPE, 20)]);
          const notice = noticeWith(page, NOT_ATTACHED);
          // The notice slides into place; its place is read once it stopped.
          yield* Effect.promise(() =>
            expect(notice).toHaveAttribute("data-mounted", "true")
          );
          yield* waitForSlide(notice);
          const read = yield* Effect.promise(() => notice.evaluate(readNotice));

          yield* Effect.sync(() => {
            expect(read).toEqual({
              endsShown: true,
              inside: true,
              namesFit: true,
              namesShown: 1,
            });
          });
        })
      );
    });

    test("reports an empty file as empty, not as too large", async ({
      page,
    }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          const composer = yield* openComposer(page);
          yield* pickFiles(composer, [fileOf("empty.txt", "text/plain", 0)]);

          yield* Effect.promise(async () => {
            const notice = noticeWith(page, NOT_ATTACHED);
            await expect(reasonIn(notice, REJECTIONS.empty)).toContainText(
              "empty.txt"
            );
            await expect(chipsIn(composer)).toHaveCount(0);
            await expect(notice).not.toContainText(LARGER);
          });
        })
      );
    });
  });
}
