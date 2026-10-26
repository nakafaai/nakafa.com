import { Array as Arr, Result, Schema } from "effect";

/** Every link that preloads a JavaScript module. */
export const MODULE_PRELOAD = /<link\b[^>]*\brel="modulepreload"[^>]*>/g;

/** The module script that starts the app, as TanStack's `<Scripts>` renders it. */
const ENTRY_SCRIPT = /<script type="module" async="" src="([^"]+)"><\/script>/g;

const PRELOAD_HREF = /\bhref="([^"]*)"/;
const PRELOAD_PRIORITY = /\bfetchPriority="([^"]*)"/;
const BODY_END = "</body>";

/** The address of one built script: the only address a static page preloads or starts. */
const ScriptPath = Schema.String.check(
  Schema.isPattern(/^\/assets\/[\w.-]+\.js$/)
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

/**
 * Starts a static page's scripts once the browser has parsed and painted the page,
 * with the attributes the page gave them, in the page's order. A hidden page paints
 * nothing, so it starts after parsing alone, and a browser that never reports the
 * paint starts after three seconds. The script removes itself, as TanStack's own
 * inline scripts do, so hydration never meets it.
 */
const STATIC_SCRIPTS_LOADER = `(function (scripts) {
  var started = false;
  var parsed = document.readyState !== "loading";
  var painted = document.visibilityState !== "visible";
  function start() {
    if (started) {
      return;
    }
    started = true;
    for (var index = 0; index < scripts.preloads.length; index++) {
      var preload = scripts.preloads[index];
      var link = document.createElement("link");
      link.rel = "modulepreload";
      link.href = preload.href;
      link.crossOrigin = "";
      if (preload.fetchPriority) {
        link.setAttribute("fetchpriority", preload.fetchPriority);
      }
      document.head.appendChild(link);
    }
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
  document.currentScript.remove();
})`;

/**
 * Defers the scripts of a prerendered page until the page has painted. A static page
 * holds its whole content in its HTML, so it needs no script to paint; but every
 * module preload in its head starts a download at once, and on a slow phone those
 * downloads and their compiles hold back the first paint. The page keeps its markup
 * and its inline scripts; its module preloads and its entry script move into one
 * inline loader at the end of the body, which starts them with the same attributes
 * after the first paint. A module that the page preloads twice keeps the attributes
 * of its first link, as the browser does.
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
        .replace(entry[0], "")
        .replace(BODY_END, () => `${loader}${BODY_END}`);
    })
  );
}
