import { Array as Arr } from "effect";
import { KNOWN_ACCOUNT_KEY, KNOWN_SESSION_KEY } from "@/lib/auth/keys";

/** The root attribute that names the plan of the account row the browser kept. */
export const KEPT_PLAN_ATTRIBUTE = "data-kept-plan";

/** The root custom property that holds the kept account's name, as a CSS string. */
export const KEPT_NAME_PROPERTY = "--kept-account-name";

/**
 * The inline script that draws the account row the browser kept into the
 * page's first frame. A prerendered page cannot know the account, so its member
 * footer holds the row with no account in it (`sidebar/user/kept.tsx`). When the
 * kept row belongs to the session the browser holds, as `readKnownAccount`
 * decides, the script names its plan on the root and its name in a custom
 * property, and the row's styles show both. A row of another session, a row it
 * cannot read, and a storage the page cannot read leave the row hidden, as a
 * browser that kept no row does, and the live row draws once the account loads.
 * Control characters are dropped from the name, since a CSS string reads their
 * JSON escapes as letters.
 */
export const KEPT_ACCOUNT_SCRIPT = Arr.join(
  [
    "(function () {",
    "  try {",
    `    var session = localStorage.getItem('${KNOWN_SESSION_KEY}');`,
    `    var account = JSON.parse(localStorage.getItem('${KNOWN_ACCOUNT_KEY}') || 'null');`,
    "    if (!session || !account || account.sessionId !== session) return;",
    "    if (typeof account.name !== 'string' || typeof account.plan !== 'string') return;",
    "    var root = document.documentElement;",
    `    root.setAttribute('${KEPT_PLAN_ATTRIBUTE}', account.plan);`,
    `    root.style.setProperty('${KEPT_NAME_PROPERTY}', JSON.stringify(account.name.replace(/[\\u0000-\\u001f\\u007f]/g, '')));`,
    "  } catch (error) {}",
    "})();",
  ],
  "\n"
);
