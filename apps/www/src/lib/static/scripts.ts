import {
  READER_GESTURES,
  UNTOUCHED_WAIT,
} from "@repo/design-system/lib/settle";
import { Array as Arr, Duration, Result, Schema } from "effect";
import { SIGNED_IN_ATTRIBUTE } from "@/lib/auth/hint";

/** Every link that preloads a JavaScript module. */
export const MODULE_PRELOAD = /<link\b[^>]*\brel="modulepreload"[^>]*>/gu;

/** The module script that starts the app, as TanStack's `<Scripts>` renders it. */
const ENTRY_SCRIPT =
  /<script type="module" async="" src="(?<src>[^"]+)"><\/script>/gu;

/**
 * The module preloads of one route in the router's dehydrated manifest. The head
 * renders a link for each, and only the head reads them.
 */
const MANIFEST_PRELOADS = /preloads:(?<slot>\$R\[\d+\])=\[[^\]]*\]/gu;

const PRELOAD_HREF = /\bhref="(?<href>[^"]*)"/u;
const PRELOAD_PRIORITY = /\bfetchPriority="(?<priority>[^"]*)"/u;
const BODY_END = "</body>";

/**
 * The address of one built script: the only address a static page preloads or starts.
 * Rolldown names a merged group `shared~entry-hash.js`.
 */
const ScriptPath = Schema.String.check(
  Schema.isPattern(/^\/assets\/[\w.~-]+\.js$/u)
);

const ModulePreload = Schema.Struct({
  fetchPriority: Schema.optionalKey(Schema.Literals(["auto", "high", "low"])),
  href: ScriptPath,
});

/** The scripts of one static page: its module preloads, in the order the page listed them, and its entry. */
const StaticScripts = Schema.Struct({
  entry: ScriptPath,
  preloads: Schema.Array(ModulePreload),
});

const StaticScriptsJson = Schema.fromJsonString(StaticScripts);

/** A prerendered page whose scripts are not the ones TanStack writes, so the build cannot defer them. */
class StaticScriptsUnreadable extends Schema.TaggedError<StaticScriptsUnreadable>()(
  "StaticScriptsUnreadable",
  { reason: Schema.String }
) {}

/** The reader's gestures, written as the array literal of the inline loader. */
const READER_GESTURES_LITERAL = `[${Arr.join(
  Arr.map(READER_GESTURES, (name) => `"${name}"`),
  ", "
)}]`;

/**
 * Starts a static page's scripts. A signed-in learner's page starts once the browser
 * has parsed and painted it, with the attributes the page gave its scripts, in the
 * page's order: a hidden page paints nothing, so it starts after parsing alone, and a
 * browser that never reports the paint starts after three seconds. A visitor's page
 * holds its whole content in its HTML, so it starts at the reader's first gesture, or
 * after the untouched wait once the page has loaded, as `untilPageRead` does for
 * decoration (ADR 0039 D8): a phone spends its first seconds on the page, not on
 * hydrating it, and a press in between keeps its control through `EARLY_PRESS_SCRIPT`.
 * The script removes itself, as TanStack's own inline scripts do, so hydration never
 * meets it.
 */
const STATIC_SCRIPTS_LOADER = `(function (scripts) {
  var started = false;
  var parsed = document.readyState !== "loading";
  var painted = document.visibilityState !== "visible";
  var gestures = ${READER_GESTURES_LITERAL};
  function start() {
    if (started) {
      return;
    }
    started = true;
    for (var gesture = 0; gesture < gestures.length; gesture++) {
      window.removeEventListener(gestures[gesture], start, true);
    }
    var links = document.createDocumentFragment();
    for (var index = 0; index < scripts.preloads.length; index++) {
      var preload = scripts.preloads[index];
      var link = document.createElement("link");
      link.rel = "modulepreload";
      link.href = preload.href;
      link.crossOrigin = "";
      if (preload.fetchPriority) {
        link.setAttribute("fetchpriority", preload.fetchPriority);
      }
      links.appendChild(link);
    }
    document.head.appendChild(links);
    var entry = document.createElement("script");
    entry.type = "module";
    entry.setAttribute("async", "");
    entry.src = scripts.entry;
    document.head.appendChild(entry);
  }
  function startAfterPaint() {
    if (parsed && painted) {
      requestAnimationFrame(function () {
        setTimeout(start, 0);
      });
    }
  }
  function startUntouched() {
    setTimeout(start, ${Duration.toMillis(UNTOUCHED_WAIT)});
  }
  if (document.documentElement.getAttribute("${SIGNED_IN_ATTRIBUTE}") === "yes") {
    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        for (var index = 0; index < entries.length; index++) {
          if (entries[index].name === "first-contentful-paint") {
            painted = true;
            startAfterPaint();
          }
        }
      }).observe({ type: "paint", buffered: true });
    } catch (error) {
      painted = true;
    }
    document.addEventListener("DOMContentLoaded", function () {
      parsed = true;
      startAfterPaint();
    });
    startAfterPaint();
    setTimeout(start, 3000);
  } else {
    for (var gesture = 0; gesture < gestures.length; gesture++) {
      window.addEventListener(gestures[gesture], start, { capture: true, passive: true });
    }
    if (document.readyState === "complete") {
      startUntouched();
    } else {
      window.addEventListener("load", startUntouched, { once: true });
    }
  }
  document.currentScript.remove();
})`;

/**
 * Defers the scripts of a prerendered page until the page has painted, and for a
 * visitor until the page has its reader. A static page holds its whole content in its
 * HTML, so it needs no script to paint; but every module preload in its head starts a
 * download at once, and on a slow phone those downloads and their compiles hold back
 * the first paint. The page keeps its markup and its inline scripts; its module
 * preloads and its entry script move into one inline loader at the end of the body,
 * which starts them with the same attributes when `STATIC_SCRIPTS_LOADER` says. A module that the page preloads twice keeps the attributes
 * of its first link, as the browser does. The router's dehydrated manifest stops
 * naming the preloads, so the head that React hydrates adds no second link for a
 * module that the loader has already started.
 */
export function deferStaticScripts(
  html: string
): Result.Result<string, StaticScriptsUnreadable> {
  const entries = Arr.fromIterable(html.matchAll(ENTRY_SCRIPT));
  const [entry] = entries;
  if (entry === undefined || entries.length > 1) {
    return Result.fail(
      new StaticScriptsUnreadable({
        reason: `The page has ${entries.length} entry scripts, not one.`,
      })
    );
  }
  if (html.split(BODY_END).length !== 2) {
    return Result.fail(
      new StaticScriptsUnreadable({ reason: "The page has no single body." })
    );
  }
  const preloads = Arr.map(
    Arr.fromIterable(html.matchAll(MODULE_PRELOAD)),
    ([tag]) => {
      const priority = PRELOAD_PRIORITY.exec(tag)?.[1];
      return {
        href: PRELOAD_HREF.exec(tag)?.[1],
        ...(priority === undefined ? {} : { fetchPriority: priority }),
      };
    }
  );
  return Schema.decodeUnknownResult(StaticScripts)({
    entry: entry[1],
    preloads,
  }).pipe(
    Result.mapError(
      (error) => new StaticScriptsUnreadable({ reason: error.message })
    ),
    Result.map((scripts) => {
      const unique = {
        entry: scripts.entry,
        preloads: Arr.dedupeWith(
          scripts.preloads,
          (first, second) => first.href === second.href
        ),
      };
      const loader = `<script>${STATIC_SCRIPTS_LOADER}(${Schema.encodeSync(StaticScriptsJson)(unique)});</script>`;
      return html
        .replace(MODULE_PRELOAD, "")
        .replace(MANIFEST_PRELOADS, "preloads:$<slot>=[]")
        .replace(entry[0], "")
        .replace(BODY_END, () => `${loader}${BODY_END}`);
    })
  );
}
