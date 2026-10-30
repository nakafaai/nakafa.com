import type { Ref } from "@confect/core";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import { Array as Arr, Option, Schema } from "effect";
import { canOpenRooms } from "@/components/tenant/exams/access";
import { ScopeChoice, scopeChoices } from "@/components/tenant/exams/create";

/** The viewer's view of the school, as the school layout and the home read it. */
type Viewer = Ref.Returns<typeof tenancy.viewer.get>;

/**
 * What the viewer may do with exams in the school, as the school layout's gate computes it from the
 * viewer it reads. The shell's context carries it to every page of the school, so the pages draw the
 * actions and the tiles that the viewer may use in their first frame.
 */
export const HomeAccessSchema = Schema.Struct({
  canCreate: Schema.Boolean,
  canWatch: Schema.Boolean,
  choices: Schema.Array(ScopeChoice),
});

/** What the viewer may do with exams in the school, as the school layout carries it. */
export type HomeAccess = typeof HomeAccessSchema.Type;

/**
 * What the school home lets the viewer do with exams, decided from the viewer's own actions. A viewer
 * may create an exam where the server lets the viewer edit exams, and may watch the rooms where the
 * server lets the viewer open them. The choices feed the create dialog.
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
  };
};

/**
 * Whether the home shows the student's view, with the student's exams, results and classes. That is a student, and
 * also a member with no grant, which the layout reads as no role, who may neither create exams nor watch rooms and does
 * not manage the school: such a member has no room to watch, and the student's view tells them they are in no class
 * yet. Staff with a role keep the staff home, which shows only what their actions allow, since the student's sentences
 * are not theirs.
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
