import { api } from "@repo/backend/convex/_generated/api";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { fetchQuery } from "convex/nextjs";
import { Effect } from "effect";
import { makeTryoutRuntimeRequest } from "@/components/tryout/content/request";
import { env } from "@/env";
import { PROTECTED_CONTENT_RUNTIME_PATH } from "@repo/backend/content/endpoint";
import { createContentEndpoint, encodeContentRequest } from "@repo/backend/client/content/transport";

const featured = await fetchQuery(
  api.tryouts.queries.catalog.getFeaturedQuestion,
  { appLocale: "en" },
  { url: env.NEXT_PUBLIC_CONVEX_URL }
);
const request = await Effect.runPromise(makeTryoutRuntimeRequest([featured.question]));
const token = contentRuntimeKeys().CONTENT_RUNTIME_TOKEN;
const endpoint = await Effect.runPromise(createContentEndpoint(env.NEXT_PUBLIC_CONVEX_SITE_URL, PROTECTED_CONTENT_RUNTIME_PATH));
const source = await Effect.runPromise(encodeContentRequest(request, 1_000_000));
const response = await fetch(endpoint, {
  body: source,
  headers: {
    "x-nakafa-content-token": token,
    "content-type": "application/json",
  },
  method: "POST",
});
console.log("STATUS", response.status);
const text = await response.text();
console.log("BODY", text.slice(0, 200));
