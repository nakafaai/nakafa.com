import { isRenderableCurriculumRoute } from "@repo/contents/_types/route/curriculum";
import { describe, expect, it } from "vitest";
import {
  readCurriculumRouteModel,
  readCurriculumRoutes,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";
import { readCurriculumRouteIcon } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/icons";

describe("curriculum route icons", () => {
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
          const iconKey = JSON.stringify(readCurriculumRouteIcon(child));
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
