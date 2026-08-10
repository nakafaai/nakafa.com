import { Data, Effect, Schedule } from "effect";

const sceneLoadRetrySchedule = Schedule.exponential("500 millis");

type ProjectileSceneLoader = () => Promise<
  typeof import("@/components/marketing/about/projectile/scene")["ProjectileScene"]
>;

/** Expected failure while loading the deferred WebGL lesson scene. */
class ProjectileSceneLoadError extends Data.TaggedError(
  "ProjectileSceneLoadError"
)<{
  cause: unknown;
  message: string;
}> {}

/**
 * Loads the deferred WebGL lesson scene with bounded retries.
 *
 * @see https://effect.website/docs/error-management/retrying/
 */
export const loadProjectileScene = Effect.fn("www.home.loadProjectileScene")(
  (loadScene: ProjectileSceneLoader) =>
    Effect.tryPromise({
      catch: (cause) =>
        new ProjectileSceneLoadError({
          cause,
          message: "Failed to load the projectile lesson scene.",
        }),
      try: loadScene,
    }).pipe(
      Effect.retry({
        schedule: sceneLoadRetrySchedule,
        times: 3,
      })
    )
);
