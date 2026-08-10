import { Data, Effect, Schedule } from "effect";

const sceneLoadRetrySchedule = Schedule.exponential("500 millis");

/** Expected failure while loading the deferred WebGL lesson scene. */
class FeaturesProjectileSceneLoadError extends Data.TaggedError(
  "FeaturesProjectileSceneLoadError"
)<{
  cause: unknown;
  message: string;
}> {}

/**
 * Loads the WebGL lesson scene after its viewport observer signals intent.
 *
 * @see https://nextjs.org/docs/app/guides/lazy-loading
 * @see https://effect-ts.github.io/effect/effect/Effect.ts.html#retry
 */
export const loadFeaturesProjectileScene = Effect.fn(
  "www.home.loadFeaturesProjectileScene"
)(() =>
  Effect.tryPromise({
    catch: (cause) =>
      new FeaturesProjectileSceneLoadError({
        cause,
        message: "Failed to load the projectile lesson scene.",
      }),
    try: () =>
      import("@/components/marketing/about/features-projectile-scene").then(
        (module) => module.FeaturesProjectileScene
      ),
  }).pipe(
    Effect.retry({
      schedule: sceneLoadRetrySchedule,
      times: 3,
    })
  )
);
