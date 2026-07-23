// @vitest-environment node

import {
  MaterialModuleImportError,
  MaterialModulePathError,
} from "@repo/contents/_lib/material/error";
import { afterEach, describe, expect, it, vi } from "vitest";
import { importMaterialModule } from "@/lib/content/material";

const captureServerException = vi.hoisted(() => vi.fn());

vi.mock("@repo/analytics/posthog/server", () => ({
  captureServerException,
}));

afterEach(() => {
  captureServerException.mockReset();
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
