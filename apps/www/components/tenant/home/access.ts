import type { Ref } from "@confect/core";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Array as Arr } from "effect";
import { canOpenRooms } from "@/components/tenant/exams/access";
import { scopeChoices, unitLanguages } from "@/components/tenant/exams/create";

/** The viewer's view of the school, as the school layout and the home read it. */
type Viewer = Ref.Returns<typeof tenancy.viewer.get>;

/**
 * What the school home lets the viewer do with exams, decided from the viewer's own actions. A viewer
 * may create an exam where the server lets the viewer edit exams, and may watch the rooms where the
 * server lets the viewer open them. The choices and languages feed the create dialog.
 */
export const homeAccess = (viewer: Pick<Viewer, "can" | "units">) => {
  const choices = scopeChoices(
    viewer.units,
    Arr.contains(viewer.can, "exam.edit")
  );
  return {
    canCreate: Arr.isReadonlyArrayNonEmpty(choices),
    canWatch: canOpenRooms(viewer),
    choices,
    languages: unitLanguages(viewer.units),
  };
};

/**
 * What the viewer may do with exams in the school, as the school layout computes it from the
 * viewer it reads on the server. The shell's context carries it to every page of the school, so the
 * pages draw the actions and the tiles that the viewer may use in their first HTML.
 */
export type HomeAccess = ReturnType<typeof homeAccess>;
