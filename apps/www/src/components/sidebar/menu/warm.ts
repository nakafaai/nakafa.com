import { useEffect, useState } from "react";
import { warmWhenIdle } from "@/lib/idle";

/**
 * The warm state of a menu whose body reads data or loads code. The body mounts once
 * the reader shows intent on the trigger, through `warm`, or in the browser's idle
 * time after hydration. The menu stays mounted while closed, so the first frame of
 * an open menu already has every item the body holds.
 */
export function useMenuWarm() {
  const [warmed, setWarmed] = useState(false);

  useEffect(() => warmWhenIdle(() => setWarmed(true)), []);

  return { warm: () => setWarmed(true), warmed };
}
