import { api } from "@repo/backend/convex/_generated/api";
import { makeFunctionReference } from "convex/server";
import { ConvexHttpClient } from "convex/browser";
import { fetchQuery } from "convex/nextjs";
import { Effect } from "effect";
import { makeTryoutRuntimeRequest } from "@/components/tryout/content/request";
import { env } from "@/env";

const featured = await fetchQuery(
  api.tryouts.queries.catalog.getFeaturedQuestion,
  { appLocale: "en" },
  { url: env.NEXT_PUBLIC_CONVEX_URL }
);
const request = await Effect.runPromise(makeTryoutRuntimeRequest([featured.question]));
const client = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
const ref = makeFunctionReference("contentRelease/runtime/protected/internal:read");
const result = await client.query(ref, request);
console.log("INTERNAL_OK rows", Array.isArray(result) ? result.length : Object.keys(result).length);
