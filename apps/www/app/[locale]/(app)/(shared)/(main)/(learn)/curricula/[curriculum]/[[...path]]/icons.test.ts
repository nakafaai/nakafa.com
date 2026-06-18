import { isRenderableCurriculumRoute } from "@repo/contents/_types/route/curriculum";
import { describe, expect, it } from "vitest";
import {
  CURRICULUM_ROUTES,
  readCurriculumRouteModel,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";
import {
  readCurriculumGroupIcon,
  readCurriculumRouteIcon,
  readCurriculumRouteVisualIdentity,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/icons";

describe("curriculum route icons", () => {
  it("keeps visible sibling groups unique by icon pair and tone", () => {
    const duplicates = CURRICULUM_ROUTES.filter(
      isRenderableCurriculumRoute
    ).flatMap((route) => {
      const model = readCurriculumRouteModel({ locale: route.locale, route });

      expect(readCurriculumRouteIcon(route)).toBeTruthy();

      if (model.materialCards.length > 0 || model.childRoutes.length === 0) {
        return [];
      }

      return model.childGroups.flatMap((group) => {
        const seenIconPairs = new Map<string, string>();
        const seenTones = new Map<string, string>();
        const duplicateKeys: string[] = [];

        if (group.title) {
          expect(group.iconKey).toBeTruthy();
        }

        if (group.iconKey) {
          expect(readCurriculumGroupIcon(group.iconKey)).toBeTruthy();
        }

        for (const child of group.children) {
          const { iconPair, tone } = readCurriculumRouteVisualIdentity(child);
          const iconPairKey = JSON.stringify(iconPair);
          const firstIconPath = seenIconPairs.get(iconPairKey);
          const firstTonePath = seenTones.get(tone);

          if (firstIconPath) {
            duplicateKeys.push(
              `icon:${route.locale}:${route.publicPath}:${group.key}:${firstIconPath}:${child.publicPath}`
            );
          }

          if (firstTonePath) {
            duplicateKeys.push(
              `tone:${route.locale}:${route.publicPath}:${group.key}:${firstTonePath}:${child.publicPath}`
            );
          }

          seenIconPairs.set(iconPairKey, child.publicPath);
          seenTones.set(tone, child.publicPath);
        }

        return duplicateKeys;
      });
    });

    expect(duplicates).toEqual([]);
  });
});
