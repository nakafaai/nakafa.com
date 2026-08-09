import { Data, Effect } from "effect";

/** Expected failure while loading the deferred WebGL lesson scene. */
class FeaturesProjectileSceneLoadError extends Data.TaggedError(
  "FeaturesProjectileSceneLoadError"
)<{
  cause: unknown;
  message: string;
}> {}

/** Loads the WebGL lesson scene after its viewport observer signals intent. */
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
  })
);
