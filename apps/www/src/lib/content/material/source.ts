import type { Ref } from "@confect/core";
import "@tanstack/react-start/server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect, Option, Schema } from "effect";
import type { Locale } from "use-intl";
import {
  decodeMaterialJson,
  makeMaterialProjectionError,
} from "@/lib/content/material/decode";
import { queryContentStore } from "@/lib/content/store/query";

/** Authenticates the publication shared by a lesson and its cached navigation. */
const assembleMaterialSource = Effect.fn("NakafaMaterial.assembleSource")(
  function* (
    source: Ref.Returns<typeof contentRelease.material.lesson>,
    navigation: Option.Option<
      Ref.Returns<typeof contentRelease.material.navigation>
    >,
    locale: Locale,
    publicPath: string
  ) {
    const input = {
      appLocale: AppLocaleSchema.make(locale),
      publicPath,
    };
    if (source.materialKey === null) {
      if (source.model.projectionJson !== null || Option.isSome(navigation)) {
        return yield* makeMaterialProjectionError(input);
      }
    } else {
      if (
        source.model.projectionJson === null ||
        Option.isNone(navigation) ||
        navigation.value.activeReleaseId !== source.model.activeReleaseId ||
        navigation.value.activeManifestHash !== source.model.activeManifestHash
      ) {
        return yield* makeMaterialProjectionError(input);
      }
      const projection = yield* decodeMaterialJson(
        source.model.projectionJson,
        input
      );
      if (projection.materialKey !== source.materialKey) {
        return yield* makeMaterialProjectionError(input);
      }
    }
    return {
      model: {
        ...source.model,
        siblingJson: Option.getOrUndefined(navigation)?.siblingJson ?? [],
      },
      runtimeJson: source.runtimeJson,
    };
  }
);

/** The release id makes a verified group immutable across its lesson URLs, and
 * the content store keeps it once for each release. New publications select a
 * new key. Never store a failed or mismatched publication lookup. */
const readMaterialNavigation = Effect.fn("NakafaMaterial.readNavigation")(
  function* (
    locale: Locale,
    materialKey: string,
    expectedActiveReleaseId: string
  ) {
    return yield* queryContentStore(contentRelease.material.navigation, {
      appLocale: AppLocaleSchema.make(locale),
      expectedActiveReleaseId,
      materialKey,
    });
  }
);
class MaterialReadError extends Schema.TaggedError<MaterialReadError>()(
  "MaterialReadError",
  {
    cause: Schema.Unknown,
    stage: Schema.Literals(["lesson", "navigation"]),
  }
) {}

/** The lesson is read through the content store, so the page and its social
 * image share one read of Convex for each release. */
export const fetchMaterialLesson = Effect.fn("NakafaMaterial.fetchLesson")(
  function* (locale: Locale, publicPath: string) {
    return yield* queryContentStore(contentRelease.material.lesson, {
      appLocale: AppLocaleSchema.make(locale),
      publicPath,
    });
  }
);
const completeMaterialSource = Effect.fn("NakafaMaterial.completeSource")(
  function* (
    source: Ref.Returns<typeof contentRelease.material.lesson>,
    locale: Locale,
    publicPath: string
  ) {
    const { materialKey } = source;
    const { activeReleaseId } = source.model;
    const navigation =
      materialKey !== null && activeReleaseId !== null
        ? Option.some(
            yield* readMaterialNavigation(
              locale,
              materialKey,
              activeReleaseId
            ).pipe(
              Effect.mapError(
                (cause) => new MaterialReadError({ cause, stage: "navigation" })
              )
            )
          )
        : Option.none();
    return yield* assembleMaterialSource(
      source,
      navigation,
      locale,
      publicPath
    );
  }
);

/** Rechecks a failed navigation read and retries only after a release change.
 * A fresh lesson identity proves the transition, and the typed error is the only
 * signal that the navigation read needs a second look. */
export const readMaterialSource = Effect.fn("NakafaMaterial.readSource")(
  function* (
    initial: Ref.Returns<typeof contentRelease.material.lesson>,
    locale: Locale,
    publicPath: string
  ) {
    return yield* completeMaterialSource(initial, locale, publicPath).pipe(
      Effect.catchTag("MaterialReadError", (error) =>
        fetchMaterialLesson(locale, publicPath).pipe(
          Effect.mapError(
            (cause) => new MaterialReadError({ cause, stage: "lesson" })
          ),
          Effect.flatMap((source) =>
            source.model.activeReleaseId === initial.model.activeReleaseId
              ? Effect.fail(error)
              : completeMaterialSource(source, locale, publicPath)
          )
        )
      )
    );
  }
);
