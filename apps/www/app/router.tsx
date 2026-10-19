import { schoolRewrite } from "@repo/internationalization/src/rewrite";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "@/app/routeTree.gen";

export function getRouter() {
  return createRouter({
    defaultPreload: "intent",
    rewrite: schoolRewrite,
    routeTree,
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
