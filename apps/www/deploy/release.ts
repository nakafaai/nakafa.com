import { HttpClient } from "@confect/js";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Config, Effect, Option, Schema } from "effect";

/** The Convex deployment that the build reads holds no active content release, so the build would fail. */
export class NoActiveContentRelease extends Schema.TaggedError<NoActiveContentRelease>()(
  "NoActiveContentRelease",
  {}
) {}

/**
 * The content release that a deploy builds: the active release of the Convex
 * deployment that the build reads (`VITE_CONVEX_URL`). The stack binds it to the
 * web Worker, so activating a release changes the Worker's bindings, and a deploy
 * of an unchanged commit rebuilds the static pages of the new release (ADR 0038
 * D8). Alchemy rebuilds a Vite Worker only when its files or its bindings change.
 */
export const readActiveContentRelease = Effect.fn("deploy.release.active")(
  function* () {
    const url = yield* Config.String("VITE_CONVEX_URL");
    const catalog = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(contentRelease.page.catalog, {})
    ).pipe(Effect.provide(HttpClient.layer(url)));
    return yield* Effect.fromOption(
      Option.fromNullOr(catalog.activeReleaseId)
    ).pipe(Effect.mapError(() => new NoActiveContentRelease()));
  }
);
