import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTenant } from "@/components/tenant/context";

/**
 * Draws its children only for a viewer who holds `action` in the school. A role that reads a page,
 * such as a Deputy principal on the periods, keeps the page and meets no button that the server
 * would refuse.
 */
export function WithAction({
  action,
  children,
}: {
  action: string;
  children: ReactNode;
}) {
  const { reach } = useTenant();

  return Arr.contains(reach, action) ? children : null;
}
