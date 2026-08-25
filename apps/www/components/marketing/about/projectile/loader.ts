import { Cause, Data, Effect, Schedule } from "effect";

// Four attempts plus the exponential delays stay inside the 30-second browser
// readiness contract while giving each local module evaluation five seconds.
const SCENE_LOAD_ATTEMPT_TIMEOUT = "5 seconds";
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
      Effect.timeoutOrElse({
        duration: SCENE_LOAD_ATTEMPT_TIMEOUT,
        orElse: () =>
          Effect.fail(
            new ProjectileSceneLoadError({
              cause: new Cause.TimeoutError(),
              message: "Timed out while loading the projectile lesson scene.",
            })
          ),
      }),
      Effect.retry({
        schedule: sceneLoadRetrySchedule,
        times: 3,
      })
    )
);
