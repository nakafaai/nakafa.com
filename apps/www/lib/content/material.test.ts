// @vitest-environment node

import {
  MaterialModuleImportError,
  MaterialModulePathError,
} from "@repo/contents/_lib/material/error";
import { Effect, Either } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFixedMaterialRuntimeResolver,
  importMaterialModule,
  MaterialRegistryMissingError,
  type MaterialRouteRuntime,
  matchesMaterialRouteTarget,
  resolveMaterialRuntime,
} from "@/lib/content/material";

const captureServerException = vi.hoisted(() => vi.fn());

vi.mock("@repo/analytics/posthog/server", () => ({
  captureServerException,
}));

afterEach(() => {
  captureServerException.mockReset();
});

describe("material registry runtime", () => {
  const unusedError = new MaterialRegistryMissingError({
    rendererDomain: "mathematics",
  });
  const runtime = {
    components: {},
    importer: () => Promise.reject(unusedError),
    published: () => Promise.reject(unusedError),
    rendererDomain: "mathematics",
  } satisfies MaterialRouteRuntime;

  it("assigns every renderer to only its physical material route", () => {
    expect([
      matchesMaterialRouteTarget("biology", "generic"),
      matchesMaterialRouteTarget("chemistry", "generic"),
      matchesMaterialRouteTarget("mathematics", "generic"),
      matchesMaterialRouteTarget("chemistry", "chemistry"),
      matchesMaterialRouteTarget("biology", "chemistry"),
    ]).toEqual([true, false, false, true, false]);
  });

  it("returns the exact fixed-domain runtime", () => {
    const resolver = createFixedMaterialRuntimeResolver(runtime);

    expect(resolveMaterialRuntime(resolver, "mathematics")).toEqual(
      Either.right(runtime)
    );
  });

  it("rejects a fixed registry returned for another domain", () => {
    const resolver = createFixedMaterialRuntimeResolver(runtime);

    expect(resolveMaterialRuntime(resolver, "chemistry")).toMatchObject({
      _tag: "Left",
      left: {
        _tag: "MaterialRegistryMissingError",
        rendererDomain: "chemistry",
      },
    });
  });

  it("preserves an adapter's typed missing-registry failure", () => {
    const error = new MaterialRegistryMissingError({
      rendererDomain: "physics",
    });

    expect(resolveMaterialRuntime(() => Either.left(error), "physics")).toEqual(
      Either.left(error)
    );
  });

  it("composes a missing registry in the Effect error channel", async () => {
    const error = new MaterialRegistryMissingError({
      rendererDomain: "biology",
    });

    await expect(
      Effect.runPromise(Effect.fail(error).pipe(Effect.flip))
    ).resolves.toBe(error);
  });
});

describe("bounded material module import", () => {
  it("returns the route-domain module and forwards its exact identity", async () => {
    const content = { default: () => null };
    const importer = vi.fn(() => Promise.resolve(content));

    await expect(
      importMaterialModule({
        importer,
        locale: "id",
        rendererDomain: "chemistry",
        sourcePath: "material/lesson/chemistry/topic/lesson",
      })
    ).resolves.toBe(content);
    expect(importer).toHaveBeenCalledWith(
      "material/lesson/chemistry/topic/lesson",
      "id",
      "chemistry"
    );
  });

  it("reports import failures with optional route context", async () => {
    const importer = vi.fn(() =>
      Promise.reject(
        new MaterialModuleImportError({
          domain: "mathematics",
          sourcePath: "material/lesson/mathematics/topic/lesson",
        })
      )
    );
    captureServerException.mockResolvedValue(undefined);

    await expect(
      importMaterialModule({
        context: { route_kind: "subject-lesson" },
        importer,
        locale: "en",
        rendererDomain: "mathematics",
        sourcePath: "material/lesson/mathematics/topic/lesson",
      })
    ).rejects.toMatchObject({ _tag: "MaterialModuleImportError" });
    expect(captureServerException).toHaveBeenCalledWith(
      expect.objectContaining({ _tag: "MaterialModuleImportError" }),
      undefined,
      {
        file_path: "material/lesson/mathematics/topic/lesson",
        locale: "en",
        route_kind: "subject-lesson",
        source: "material-public-route",
      }
    );
  });

  it("preserves the import failure when analytics reporting also fails", async () => {
    const importer = vi.fn(() =>
      Promise.reject(
        new MaterialModuleImportError({
          domain: "physics",
          sourcePath: "material/lesson/physics/topic/lesson",
        })
      )
    );
    captureServerException.mockRejectedValue(new TypeError("analytics down"));

    await expect(
      importMaterialModule({
        importer,
        locale: "en",
        rendererDomain: "physics",
        sourcePath: "material/lesson/physics/topic/lesson",
      })
    ).rejects.toMatchObject({ _tag: "MaterialModuleImportError" });
  });

  it("preserves a typed domain-path rejection", async () => {
    const error = new MaterialModulePathError({
      domain: "mathematics",
      reason: "domain",
      sourcePath: "material/lesson/physics/topic/lesson",
    });
    const importer = vi.fn(() => Promise.reject(error));
    captureServerException.mockResolvedValue(undefined);

    await expect(
      importMaterialModule({
        importer,
        locale: "en",
        rendererDomain: "mathematics",
        sourcePath: error.sourcePath,
      })
    ).rejects.toBe(error);
  });

  it("normalizes an unexpected importer rejection before reporting", async () => {
    const importer = vi.fn(() =>
      Promise.reject(new TypeError("module missing"))
    );
    captureServerException.mockResolvedValue(undefined);

    await expect(
      importMaterialModule({
        importer,
        locale: "en",
        rendererDomain: "biology",
        sourcePath: "material/lesson/biology/topic/lesson",
      })
    ).rejects.toMatchObject({
      _tag: "MaterialModuleImportError",
      domain: "biology",
    });
  });
});
