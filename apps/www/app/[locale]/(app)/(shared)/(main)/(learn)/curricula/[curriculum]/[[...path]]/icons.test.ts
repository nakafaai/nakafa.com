import { PROGRAM_NAVIGATION_ICON_KEY_VALUES } from "@repo/contents/_types/program/schema";
import { isRenderableCurriculumRoute } from "@repo/contents/_types/route/curriculum";
import { SUBJECT_MATERIALS } from "@repo/contents/_types/taxonomy";
import { describe, expect, it } from "vitest";
import {
  readCurriculumRouteModel,
  readCurriculumRoutes,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";
import {
  readCurriculumMaterialIcon,
  readCurriculumNavigationIcon,
  readCurriculumRouteIcon,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/icons";

function serializeIcon(icon: unknown) {
  return JSON.stringify(icon);
}

describe("curriculum route icons", () => {
  it("keeps navigation icons distinct from material subject icons", () => {
    const subjectIcons = new Map(
      SUBJECT_MATERIALS.map((material) => [
        serializeIcon(readCurriculumMaterialIcon(material)),
        material,
      ])
    );

    const overlaps = PROGRAM_NAVIGATION_ICON_KEY_VALUES.flatMap((key) => {
      const material = subjectIcons.get(
        serializeIcon(readCurriculumNavigationIcon(key))
      );

      if (!material) {
        return [];
      }

      return [`${key}:${material}`];
    });

    expect(overlaps).toEqual([]);
  });

  it("keeps navigation keys unique by icon", () => {
    const seenIcons = new Map<string, string>();
    const duplicates: string[] = [];

    for (const key of PROGRAM_NAVIGATION_ICON_KEY_VALUES) {
      const iconKey = serializeIcon(readCurriculumNavigationIcon(key));
      const firstKey = seenIcons.get(iconKey);

      if (firstKey) {
        duplicates.push(`${firstKey}:${key}`);
      }

      seenIcons.set(iconKey, key);
    }

    expect(duplicates).toEqual([]);
  });

  it("keeps visible sibling cards unique by icon", () => {
    const duplicates = readCurriculumRoutes()
      .filter(isRenderableCurriculumRoute)
      .flatMap((route) => {
        const model = readCurriculumRouteModel({ locale: route.locale, route });

        expect(readCurriculumRouteIcon(route)).toBeTruthy();

        if (model.materialCards.length > 0 || model.childRoutes.length === 0) {
          return [];
        }

        const seenIcons = new Map<string, string>();
        const duplicateKeys: string[] = [];

        for (const child of model.childRoutes) {
          const iconKey = serializeIcon(readCurriculumRouteIcon(child));
          const firstIconPath = seenIcons.get(iconKey);

          if (firstIconPath) {
            duplicateKeys.push(
              `${route.locale}:${route.publicPath}:${firstIconPath}:${child.publicPath}`
            );
          }

          seenIcons.set(iconKey, child.publicPath);
        }

        return duplicateKeys;
      });

    expect(duplicates).toEqual([]);
  });
});
