import type { Ref } from "@confect/core";
import "@tanstack/react-start/server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect, Schema } from "effect";
import type { Locale } from "use-intl";
import {
  decodeMaterialJson,
  makeMaterialProjectionError,
  verifyMaterialPublication,
} from "@/lib/content/material/decode";
import { decodePublishedMaterialRoute } from "@/lib/content/material/route";
import { decodePublishedDelivery } from "@/lib/content/published/exchange";
import {
  decodeMaterialData,
  renderMaterialArtifact,
} from "@/lib/content/published/material";
import { queryContentStore } from "@/lib/content/store/query";

/** Verifies the signed query result without evaluating its immutable body.
 *
 * Static consumers such as social images resolve metadata through this seam
 * so their module graph never renders interactive renderers. */
const decodeMaterialModel = Effect.fn("NakafaMaterial.decodeModel")(function* (
  source: Effect.Success<ReturnType<typeof assembleMaterialSource>>,
  locale: Locale,
  publicPath: string
) {
  const input = {
    appLocale: AppLocaleSchema.make(locale),
    publicPath,
  };
  const model = yield* decodePublishedMaterialRoute(
    source.model,
    locale,
    publicPath
  );
  if (!model.projection) {
    if (source.runtimeJson !== null) {
      return yield* makeMaterialProjectionError(input);
    }
    return null;
  }
  if (source.runtimeJson === null) {
    return yield* makeMaterialProjectionError(input);
  }
  const data = yield* decodePublishedDelivery(input, source.runtimeJson);
  const narrowed = yield* decodeMaterialData(data, input);
  yield* verifyMaterialPublication(
    {
      activeReleaseId: model.activeReleaseId,
      projection: model.projection,
    },
    narrowed
  );
  return {
    model,
    narrowed,
  };
});

/** Verifies the complete query result before evaluating its immutable body. */
const decodeMaterialDelivery = Effect.fn("NakafaMaterial.decodeDelivery")(
  function* (
    source: Effect.Success<ReturnType<typeof assembleMaterialSource>>,
    locale: Locale,
    publicPath: string
  ) {
    const decoded = yield* decodeMaterialModel(source, locale, publicPath);
    if (!decoded) {
      return null;
    }
    const published = yield* renderMaterialArtifact(decoded.narrowed);
    return {
      model: decoded.model,
      published,
    };
  }
);

/** Authenticates the publication shared by a lesson and its cached navigation. */
const assembleMaterialSource = Effect.fn("NakafaMaterial.assembleSource")(
  function* (
    source: Ref.Returns<typeof contentRelease.material.lesson>,
    navigation: Ref.Returns<typeof contentRelease.material.navigation> | null,
    locale: Locale,
    publicPath: string
  ) {
    const input = {
      appLocale: AppLocaleSchema.make(locale),
      publicPath,
    };
    if (source.materialKey === null) {
      if (source.model.projectionJson !== null || navigation !== null) {
        return yield* makeMaterialProjectionError(input);
      }
    } else {
      if (
        source.model.projectionJson === null ||
        navigation === null ||
        navigation.activeReleaseId !== source.model.activeReleaseId ||
        navigation.activeManifestHash !== source.model.activeManifestHash
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
        siblingJson: navigation?.siblingJson ?? [],
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
const fetchMaterialLesson = Effect.fn("NakafaMaterial.fetchLesson")(function* (
  locale: Locale,
  publicPath: string
) {
  return yield* queryContentStore(contentRelease.material.lesson, {
    appLocale: AppLocaleSchema.make(locale),
    publicPath,
  });
});
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
        ? yield* readMaterialNavigation(
            locale,
            materialKey,
            activeReleaseId
          ).pipe(
            Effect.mapError(
              (cause) => new MaterialReadError({ cause, stage: "navigation" })
            )
          )
        : null;
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
const readMaterialSource = Effect.fn("NakafaMaterial.readSource")(function* (
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
});

/** Reads and verifies one signed material delivery for the lesson page. */
export const getMaterialPublication = Effect.fn(
  "NakafaMaterial.getPublication"
)(function* (locale: Locale, publicPath: string) {
  const source = yield* fetchMaterialLesson(locale, publicPath);
  const assembled = yield* readMaterialSource(source, locale, publicPath);
  return yield* decodeMaterialDelivery(assembled, locale, publicPath);
});

/** Reads and verifies signed release metadata without rendering its body.
 *
 * Social images resolve copy through this seam so a missing release falls
 * back to brand artwork instead of rendering the application shell. */
export const getMaterialModel = Effect.fn("NakafaMaterial.getModel")(function* (
  locale: Locale,
  publicPath: string
) {
  const source = yield* fetchMaterialLesson(locale, publicPath);
  const assembled = yield* readMaterialSource(source, locale, publicPath);
  return yield* decodeMaterialModel(assembled, locale, publicPath);
});
