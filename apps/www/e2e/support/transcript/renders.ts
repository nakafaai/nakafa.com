import type { Page } from "@playwright/test";
import { Schema } from "effect";

/** One commit of the page: how many transcript rows rendered again in it. */
const Commit = Schema.Struct({
  rows: Schema.Finite,
});
type Commit = typeof Commit.Type;

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown;
    /** Every commit since the page loaded, in order. */
    renderCommits: Commit[];
  }
}

/**
 * Records, after every commit of the page, how many transcript rows React
 * rendered again. React DOM calls the DevTools hook after each commit in
 * production builds too, so the hook is installed before the page's code runs.
 * A row renders again when React gives its component new props, and a settled
 * row that its memo skips keeps the props it had. The rows are told apart by
 * their message keys.
 */
export const watchRenders = (page: Page) =>
  page.addInitScript(() => {
    const isObject = (value: unknown): value is object =>
      typeof value === "object" && value !== null;

    /** The message key of the transcript row that `fiber` renders, or none for any other fiber. */
    const rowKeyOf = (fiber: object) => {
      // Tag 0 is a function component. The row is the one component that takes
      // both a message and the loader of older messages.
      const props = "memoizedProps" in fiber ? fiber.memoizedProps : null;
      if (!("tag" in fiber) || fiber.tag !== 0 || !isObject(props)) {
        return null;
      }
      if (
        !(
          "loadMore" in props &&
          "message" in props &&
          isObject(props.message) &&
          "key" in props.message
        ) ||
        typeof props.message.key !== "string"
      ) {
        return null;
      }
      return props.message.key;
    };

    /** The props each row rendered with last, by message key. */
    const propsSeen = new Map<string, unknown>();

    /** One when `fiber` renders a row with props it has not rendered with, and zero otherwise. */
    const newRowProps = (fiber: object) => {
      const key = rowKeyOf(fiber);
      const props = "memoizedProps" in fiber ? fiber.memoizedProps : null;
      if (key === null || propsSeen.get(key) === props) {
        return 0;
      }
      propsSeen.set(key, props);
      return 1;
    };

    /** The child and the sibling of `fiber`, which the walk visits next. */
    const fibersBelow = (fiber: object) => {
      const below: unknown[] = [];
      if ("child" in fiber) {
        below.push(fiber.child);
      }
      if ("sibling" in fiber) {
        below.push(fiber.sibling);
      }
      return below;
    };

    /** How many rows of the tree under `root` have new props since they were last seen. */
    const rowsRendered = (root: unknown) => {
      let rows = 0;
      const pending: unknown[] =
        isObject(root) && "current" in root ? [root.current] : [];
      while (pending.length > 0) {
        const fiber = pending.pop();
        if (isObject(fiber)) {
          rows += newRowProps(fiber);
          pending.push(...fibersBelow(fiber));
        }
      }
      return rows;
    };

    window.renderCommits = [];
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      checkDCE() {
        // React checks its own dead code elimination here; nothing to do.
      },
      inject: () => 1,
      isDisabled: false,
      onCommitFiberRoot(_rendererId: number, root: unknown) {
        window.renderCommits.push({
          rows: rowsRendered(root),
        });
      },
      onCommitFiberUnmount() {
        // Unmounts need no count; the rows are told apart by key.
      },
      onPostCommitFiberRoot() {
        // The commit is counted when it is made, so nothing waits here.
      },
      setStrictMode() {
        // Strict mode changes no row's props, so it needs no count.
      },
      supportsFiber: true,
    };
  });

/** The commits the page made after the first `from` of them, in order. */
export const commitsAfter = (page: Page, from: number) =>
  page.evaluate((start) => window.renderCommits.slice(start), from);

/** How many commits the page has made so far. */
export const commitCount = (page: Page) =>
  page.evaluate(() => window.renderCommits.length);
