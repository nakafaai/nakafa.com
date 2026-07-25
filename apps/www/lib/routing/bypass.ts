const UNSUPPORTED_ROOT_FILE_PATTERN =
  /^\/[^/]+\.(?:svg|jpg|jpeg|gif|webp|glb|gltf|bin|ktx2|hdr|exr|js|css|xml|webmanifest|txt)$/i;
const LOCALE_BYPASS_PATHS = new Set([
  "/mcp",
  "/llms.txt",
  "/logo.svg",
  "/manifest.webmanifest",
  "/robots.txt",
  "/rss.xml",
  "/sitemap.txt",
  "/sitemap.xml",
  "/skill.md",
  "/e22d548f7fd2482a9022e3b84e944901.txt",
  "/.well-known/llms.txt",
  "/.well-known/agent-skills/index.json",
  "/.well-known/agent-skills/nakafa/SKILL.md",
]);

/** Returns whether one public AI or system path skips locale routing. */
export function isLocaleBypassPath(pathname: string) {
  return LOCALE_BYPASS_PATHS.has(pathname);
}

/** Rejects unsupported root files before they become invalid locales. */
export function isUnsupportedRootFilePath(pathname: string) {
  return UNSUPPORTED_ROOT_FILE_PATTERN.test(pathname);
}
