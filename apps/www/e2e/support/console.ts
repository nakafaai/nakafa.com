import { Array as Arr } from "effect";

/**
 * What the test browser itself makes the console say, which no code of the page wrote about the page: Firefox's
 * notes on a page's performance, such as a scroll that moves an element, and PostHog's one warning that it drops the
 * events of a browser that says it is automated (`navigator.webdriver`, which every Playwright engine reports and
 * no launch option of Firefox or WebKit turns off).
 */
const BROWSER_NOTES = [
  /^\[JavaScript Warning:/u,
  /^\[PostHog\.js\] Events are being dropped because the user agent looks like a bot\./u,
];

/** Whether a console message is an error or a warning that the page wrote, rather than a note of the test browser. */
export function isPageComplaint(message: {
  readonly text: () => string;
  readonly type: () => string;
}) {
  const type = message.type();
  return (
    (type === "error" || type === "warning") &&
    !Arr.some(BROWSER_NOTES, (note) => note.test(message.text()))
  );
}
