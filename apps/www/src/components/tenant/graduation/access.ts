import type { Ref } from "@confect/core";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Array as Arr } from "effect";

/** The viewer's view of the school, as the school layout reads it. */
type Viewer = Ref.Returns<typeof tenancy.viewer.get>;

/**
 * Whether a viewer may open the graduation pages and the sidebar item: the viewer holds the
 * graduation open action in one of the school's units, as a principal, an Admin, or Staff.
 * Which class groups graduate is the server's answer, so this only decides what the school shows.
 */
export const canOpenGraduation = (viewer: Pick<Viewer, "units">) =>
  Arr.some(viewer.units, (unit) => Arr.contains(unit.can, "graduation.open"));
