import { ComingSoon } from "@/components/shared/coming-soon";
import {
  LayoutMaterial,
  LayoutMaterialContent,
  LayoutMaterialMain,
} from "@/components/shared/layout-material";

/** Renders the fallback UI when an exercise route has no available content yet. */
export function MissingExercisePage() {
  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <LayoutMaterialMain className="py-24">
          <ComingSoon />
        </LayoutMaterialMain>
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
