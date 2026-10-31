import { MAIN_DOMAIN } from "@repo/site/domains";
import { Array as Arr, Result, Schema, String as Str } from "effect";
import { SIGNED_IN_HINT_COOKIE } from "#www/src/lib/auth/hint";

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
const LOW_PRELOAD_PRIORITY = /\s+fetchPriority="low"/u;
const BODY_END = "</body>";

/** The address of one built script: the only address a static page preloads or starts. */
const ScriptPath = Schema.String.check(
  Schema.isPattern(/^\/assets\/[\w.-]+\.js$/u)
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

/** The address of a school host, or of a local one. */
const SCHOOL_HOST = `^[^.]+\\.(${Str.replaceAll(".", "\\.")(MAIN_DOMAIN)}|localhost)$`;

/** The scripts that the browser shell preloads on a school host, for a visitor and for a member. */
const ShellScripts = Schema.Struct({
  cookie: Schema.String,
  host: Schema.String,
  member: Schema.Array(ScriptPath),
  school: Schema.Array(ScriptPath),
});

const ShellScriptsJson = Schema.fromJsonString(ShellScripts);

/**
 * Preloads a school's scripts from the shell's first bytes. The shell serves every address, so it
 * cannot name a route's scripts in its head, and the router asks for them only once its own have
 * run. The script removes itself, as `STATIC_SCRIPTS_LOADER` does.
 */
const SHELL_SCRIPTS_LOADER = `(function (shell) {
  document.currentScript.remove();
  if (!new RegExp(shell.host).test(location.hostname)) {
    return;
  }
  var signedIn = document.cookie.split(";").some(function (pair) {
    return pair.trim() === shell.cookie + "=1";
  });
  var links = document.createDocumentFragment();
  shell.school.concat(signedIn ? shell.member : []).forEach(function (href) {
    var link = document.createElement("link");
    link.rel = "modulepreload";
    link.href = href;
    links.appendChild(link);
  });
  document.head.appendChild(links);
})`;

/**
 * Readies the browser shell for a slow phone, which sees nothing of a page that renders only in the
 * browser until its scripts have run. A low priority held 172 scripts behind the stylesheet for
 * 1.5 s on slow 4G, and a school's own scripts started only when those had run, so the shell starts
 * them all at once.
 */
export function prepareShell(
  html: string,
  scripts: Pick<typeof ShellScripts.Type, "member" | "school">
) {
  const loader = `<script>${SHELL_SCRIPTS_LOADER}(${Schema.encodeSync(
    ShellScriptsJson
  )({
    ...scripts,
    cookie: SIGNED_IN_HINT_COOKIE,
    host: SCHOOL_HOST,
  })});</script>`;
  return html
    .replace(MODULE_PRELOAD, (tag) => tag.replace(LOW_PRELOAD_PRIORITY, ""))
    .replace("</head>", () => `${loader}</head>`);
}
