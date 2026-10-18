import type { Ref } from "@confect/core";
import { DeliveryLanguageSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { GrantScope } from "@repo/backend/confect/access/schema";
import { Array as Arr, Option, Schema } from "effect";

/** The viewer's view of the school, as the school layout reads it. */
type Viewer = Ref.Returns<typeof tenancy.viewer.get>;

/** One unit of the school, as the viewer sees it. */
export type ViewerUnit = Viewer["units"][number];

/**
 * One place an exam can be created in: the whole school, which has no unit, or one unit.
 * `language` is the content language of the unit, or none for the whole school, where the
 * teacher picks one. `scope` is the scope the exam is created with.
 */
const ScopeChoice = Schema.Struct({
  language: Schema.NullOr(DeliveryLanguageSchema),
  scope: GrantScope,
  unitId: Schema.NullOr(Id("tenantUnits")),
  unitName: Schema.NullOr(Schema.String),
});

/** One choice of the create dialog. */
export type ScopeChoice = typeof ScopeChoice.Type;

/** The key that names a choice in the dialog's select: its unit's ID, or `school` for the whole school. */
export const choiceKey = (choice: ScopeChoice) =>
  choice.unitId === null ? "school" : choice.unitId;

/** The units that take exams: the active ones, in the order the viewer sees them. */
export const activeUnits = (units: readonly ViewerUnit[]) =>
  Arr.filter(units, (unit) => unit.status === "active");

/** A language of the school's units, as the delivery languages an exam takes. */
const languageOf = (unit: ViewerUnit) =>
  Schema.decodeSync(DeliveryLanguageSchema)(unit.contentLanguage);

/**
 * The places an exam can be created in: the whole school first when the viewer may edit
 * the school's exams, then each active unit. The whole school has no language of its own.
 */
export const scopeChoices = (
  units: readonly ViewerUnit[],
  canEditSchool: boolean
): readonly ScopeChoice[] => {
  const school: readonly ScopeChoice[] = canEditSchool
    ? [
        {
          language: null,
          scope: { kind: "tenant" },
          unitId: null,
          unitName: null,
        },
      ]
    : [];
  const unitChoices = Arr.map(
    activeUnits(units),
    (unit): ScopeChoice => ({
      language: languageOf(unit),
      scope: { kind: "unit", unitId: unit.id },
      unitId: unit.id,
      unitName: unit.name,
    })
  );
  return [...school, ...unitChoices];
};

/**
 * The choice that the dialog shows first: the first unit when there is one, so a teacher
 * creates in a unit by default, or the whole school when there is no unit. None when the
 * viewer can create nowhere, which hides the action.
 */
export const defaultChoice = (
  choices: readonly ScopeChoice[]
): Option.Option<ScopeChoice> =>
  Option.orElse(
    Arr.findFirst(choices, (choice) => choice.unitId !== null),
    () => Arr.head(choices)
  );

/** The distinct content languages of the active units, which a whole-school exam picks from. */
export const unitLanguages = (units: readonly ViewerUnit[]) =>
  Arr.dedupe(Arr.map(activeUnits(units), languageOf));
