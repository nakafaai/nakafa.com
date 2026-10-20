import type { Ref } from "@confect/core";
import { DeliveryLanguageSchema } from "@nakafa/aksara-contracts/locale";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import { Array as Arr, Option, Schema } from "effect";
import { canOpenRooms } from "@/components/tenant/exams/access";
import {
  ScopeChoice,
  scopeChoices,
  unitLanguages,
} from "@/components/tenant/exams/create";

/** The viewer's view of the school, as the school layout and the home read it. */
type Viewer = Ref.Returns<typeof tenancy.viewer.get>;

/**
 * What the viewer may do with exams in the school, as the school layout computes it from the
 * viewer it reads on the server. The shell's context carries it to every page of the school, so the
 * pages draw the actions and the tiles that the viewer may use in their first HTML.
 */
export const HomeAccessSchema = Schema.Struct({
  canCreate: Schema.Boolean,
  canWatch: Schema.Boolean,
  choices: Schema.Array(ScopeChoice),
  languages: Schema.Array(DeliveryLanguageSchema),
});

/** What the viewer may do with exams in the school, as the school layout carries it. */
export type HomeAccess = typeof HomeAccessSchema.Type;

/**
 * What the school home lets the viewer do with exams, decided from the viewer's own actions. A viewer
 * may create an exam where the server lets the viewer edit exams, and may watch the rooms where the
 * server lets the viewer open them. The choices and languages feed the create dialog.
 */
export const homeAccess = (
  viewer: Pick<Viewer, "can" | "units">
): HomeAccess => {
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
 * Whether the home shows the student's view, with the student's sittings and results. That is a
 * student, and also a member with no grant, which the layout reads as no role, who may neither create exams nor watch
 * rooms and does not manage the school. Such a member has no staff tile to show, so the student's quiet state tells
 * them that nothing is open yet. Staff with a role keep the staff home, which holds only the tiles their actions allow,
 * since the student's sentence is not theirs.
 */
export const showsStudentHome = (
  viewer: {
    readonly canManage: boolean;
    readonly role: Option.Option<BuiltinRole>;
  },
  access: Pick<HomeAccess, "canCreate" | "canWatch">
) =>
  Option.match(viewer.role, {
    onNone: () => !(viewer.canManage || access.canCreate || access.canWatch),
    onSome: (role) => role === "student",
  });
