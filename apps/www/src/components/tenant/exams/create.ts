import type { Ref } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { GrantScope } from "@repo/backend/confect/access/schema";
import { Array as Arr, type Option, Schema } from "effect";

/** The viewer's view of the school, as the school layout reads it. */
type Viewer = Ref.Returns<typeof tenancy.viewer.get>;

/** One unit of the school, as the viewer sees it. */
export type ViewerUnit = Viewer["units"][number];

/**
 * One place an exam can be created in: the whole school, which has no unit, or one unit.
 * `scope` is the scope the exam is created with.
 */
export const ScopeChoice = Schema.Struct({
  scope: GrantScope,
  unitId: Schema.NullOr(Id("tenantUnits")),
  unitName: Schema.NullOr(Schema.String),
});

/** One choice of the create dialog. */
export type ScopeChoice = typeof ScopeChoice.Type;

/** The key that names a choice in the dialog's select: its unit's ID, or `school` for the whole school. */
export const choiceKey = (choice: ScopeChoice) =>
  choice.unitId === null ? "school" : choice.unitId;

/**
 * The units a new exam can be created in: the active units where the server lets the
 * viewer take the exam edit action, in the order the viewer sees them.
 */
export const creatableUnits = (units: readonly ViewerUnit[]) =>
  Arr.filter(
    units,
    (unit) => unit.status === "active" && Arr.contains(unit.can, "exam.edit")
  );

/**
 * The places an exam can be created in: each unit the viewer may create in, in the order the
 * viewer sees them, and the whole school first when the viewer may edit the school's exams.
 * The whole school is offered only when one unit is creatable, so the dialog always has a unit
 * to show first.
 */
export const scopeChoices = (
  units: readonly ViewerUnit[],
  canEditSchool: boolean
): readonly ScopeChoice[] => {
  const unitChoices = Arr.map(
    creatableUnits(units),
    (unit): ScopeChoice => ({
      scope: { kind: "unit", unitId: unit.id },
      unitId: unit.id,
      unitName: unit.name,
    })
  );
  const school: readonly ScopeChoice[] =
    canEditSchool && Arr.isReadonlyArrayNonEmpty(unitChoices)
      ? [{ scope: { kind: "tenant" }, unitId: null, unitName: null }]
      : [];
  return [...school, ...unitChoices];
};

/**
 * The choice that the dialog shows first: the first unit, so a teacher creates in a unit by
 * default. None when the viewer can create nowhere, which hides the action.
 */
export const defaultChoice = (
  choices: readonly ScopeChoice[]
): Option.Option<ScopeChoice> =>
  Arr.findFirst(choices, (choice) => choice.unitId !== null);
