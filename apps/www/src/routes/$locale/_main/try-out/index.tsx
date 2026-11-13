import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { readTryoutHubFn } from "@/components/tryout/route/catalog.functions";
import { readStaticData } from "@/lib/static/data";

/**
 * The address of "Try out", which is no page of its own: Indonesia and Germany
 * never share a page, so it opens one country's page, the locale's own country,
 * else the catalog's first. Every link of the app opens that country itself
 * (`useLinkDestination`), the sidebar a learner's last choice, and the Worker
 * answers a request for the address the same way, so only an address written
 * by hand reaches this loader in the browser.
 */
export const Route = createFileRoute("/$locale/_main/try-out/")({
  loader: async ({ params }) => {
    const route = await readStaticData(readTryoutHubFn, {
      locale: params.locale,
    });
    if (route.kind === "notFound") {
      throw notFound();
    }
    throw redirect({
      href: `/${params.locale}/${route.entryPath}`,
      statusCode: 307,
    });
  },
});
