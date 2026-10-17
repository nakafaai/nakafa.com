import {
  getEarlyElementShellConfiguration,
  getOuterOccupiedShell,
} from "@repo/design-system/components/contents/chemistry/atom-shell/data";
import { Array as Arr, Result } from "effect";

/**
 * The shells of one neutral atom and what its footer reads from them: the
 * electron count of each occupied shell, and the outer occupied shell. A lab and
 * the static card that holds its place both read these, so they agree.
 */
export function getAtomShellReadings(atomicNumber: number) {
  const shells = Result.getOrThrow(
    getEarlyElementShellConfiguration(atomicNumber)
  );
  const occupiedShells = Arr.filter(shells, (shell) => shell.electronCount > 0);

  return {
    configurationMath: Arr.join(
      Arr.map(occupiedShells, (shell) => String(shell.electronCount)),
      ", "
    ),
    outerShell: getOuterOccupiedShell(shells),
    shells,
  };
}
