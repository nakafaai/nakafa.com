import { stringify } from "node:querystring";
import { readProtectedContent } from "@repo/backend/client/content/protected";
import { api } from "@repo/backend/convex/_generated/api";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { fetchQuery } from "convex/nextjs";
import { Effect, Exit } from "effect";
import { makeTryoutRuntimeRequest } from "@/components/tryout/content/request";
import { env } from "@/env";
import { rendererManifest } from "@/lib/content/renderer/manifest";

const featured = await fetchQuery(
  api.tryouts.queries.catalog.getFeaturedQuestion,
  { appLocale: "en" },
  { url: env.NEXT_PUBLIC_CONVEX_URL }
);
const request = await Effect.runPromise(makeTryoutRuntimeRequest([featured.question]));
const program = readProtectedContent(
  {
    siteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
    token: contentRuntimeKeys().CONTENT_RUNTIME_TOKEN,
  },
  request,
  rendererManifest
);
process.on("exit", () => {});
const exit = await Effect.runPromiseExit(program);
if (Exit.isSuccess(exit)) {
  console.log("PROBE_OK");
} else {
  console.log("PROBE_FAIL", JSON.stringify(exit.cause, null, 2).slice(0, 2000));
}
