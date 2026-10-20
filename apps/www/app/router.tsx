import { localeRewrite } from "@repo/internationalization/src/rewrite";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "@/app/routeTree.gen";
import { schoolRewrite } from "@/lib/routing/school/rewrite";

/**
 * Maps the browser's addresses to the router's and back. The school host
 * rewrite runs first on input and last on output, so the locale spelling sits
 * inside the school tree's path.
 */
const rewrite = {
  input: ({ url }: { url: URL }) =>
    localeRewrite.input({ url: schoolRewrite.input({ url }) }),
  output: ({ url }: { url: URL }) =>
    schoolRewrite.output({ url: localeRewrite.output({ url }) }),
};

export function getRouter() {
  return createRouter({
    defaultPendingMinMs: 300,
    defaultPendingMs: 200,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    rewrite,
    routeTree,
    scrollRestoration: true,
  });
}
