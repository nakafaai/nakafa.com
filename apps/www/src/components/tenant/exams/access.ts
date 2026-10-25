import type { Ref } from "@confect/core";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Array as Arr } from "effect";

/** The viewer's view of the school, as the school layout reads it. */
type Viewer = Ref.Returns<typeof tenancy.viewer.get>;

/**
 * Whether a viewer may open the exam pages and the sidebar item: the viewer holds the exam
 * view action in the school or in one of its units. An archived unit keeps its reads, so a
 * teacher whose only unit is archived still opens its exams. The server still refuses each
 * exam that the viewer may not read, so this only decides what the school shows.
 */
export const canOpenExams = (viewer: Pick<Viewer, "can" | "units">) =>
  Arr.contains(viewer.can, "exam.view") ||
  Arr.some(viewer.units, (unit) => Arr.contains(unit.can, "exam.view"));

/**
 * Whether a viewer may open the rooms of an exam: the viewer holds the exam rooms action in the
 * school or in one of its units, which the editors and the sitting viewers hold. The exam list
 * stays with `canOpenExams`, so a Principal opens a rooms page and no exam list. The server
 * still refuses each exam whose rooms the viewer may not read.
 */
export const canOpenRooms = (viewer: Pick<Viewer, "can" | "units">) =>
  Arr.contains(viewer.can, "exam.rooms") ||
  Arr.some(viewer.units, (unit) => Arr.contains(unit.can, "exam.rooms"));
