import { MaterialKeySchema } from "@nakafa/aksara-contracts/projection/material";
import {
  type MaterialContextRef,
  type MaterialRouteIdentity,
  readMaterialContextRef,
} from "@repo/contents/_types/route/material/reference";
import { describe, expect, it } from "vitest";

const route = {
  locale: "id",
  materialKey: MaterialKeySchema.make(
    "lesson.mathematics.linear-equation-inequality"
  ),
  sourcePath:
    "material/lesson/mathematics/linear-equation-inequality/system-linear-equation",
} satisfies MaterialRouteIdentity;

const reference = {
  anchor: "persamaan-dan-pertidaksamaan-linear",
  locale: "id",
  materialKey: route.materialKey,
  nodeKey: "class-10-mathematics-linear-equation-inequality",
  parentHref:
    "/id/kurikulum/merdeka/kelas-10/matematika#persamaan-dan-pertidaksamaan-linear",
  parentTitle: "Persamaan dan Pertidaksamaan Linear",
  programKey: "merdeka",
  sourcePath: route.sourcePath,
} satisfies MaterialContextRef;

describe("material context references", () => {
  it("matches a persisted context by exact material and curriculum identity", () => {
    expect(
      readMaterialContextRef({
        contextRoute: reference,
        refs: [reference],
        route,
      })
    ).toEqual(reference);
  });

  it("rejects mismatched source, locale, program, and node identities", () => {
    expect(
      readMaterialContextRef({
        contextRoute: { ...reference, nodeKey: "missing" },
        refs: [reference],
        route,
      })
    ).toBeUndefined();
    expect(
      readMaterialContextRef({
        contextRoute: reference,
        refs: [reference],
        route: { ...route, locale: "en" },
      })
    ).toBeUndefined();
  });
});
