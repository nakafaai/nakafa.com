import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import "server-only";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Effect } from "effect";
import { httpLayer } from "@/lib/convex/http";

type TryoutExamPageArgs = Ref.Args<typeof tryouts.queries.catalog.getExamPage>;
type TryoutSectionPageArgs = Ref.Args<
  typeof tryouts.queries.catalog.getSectionPage
>;

/** Reads one signed exam page with its tracks, or null when the exam is not live. */
export const readPublishedTryoutExamPage = Effect.fn(
  "www.tryouts.readExamPage"
)(function* (args: TryoutExamPageArgs) {
  return yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(tryouts.queries.catalog.getExamPage, args)
  ).pipe(Effect.provide(httpLayer()));
});

/** Reads one signed section page, or null when the section is not a visible page. */
export const readPublishedTryoutSectionPage = Effect.fn(
  "www.tryouts.readSectionPage"
)(function* (args: TryoutSectionPageArgs) {
  return yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(tryouts.queries.catalog.getSectionPage, args)
  ).pipe(Effect.provide(httpLayer()));
});
