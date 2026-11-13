import { type ReactNode, useLayoutEffect, useRef } from "react";
import type { Group } from "three";

/**
 * Holds the abstractions of a lab, its vector arrows and guides, so that
 * none of them casts a shadow: a shadow of an arrow on the ground would read
 * as one more vector. Real objects outside it keep their shadows.
 */
export function Guide({ children }: { readonly children: ReactNode }) {
  const group = useRef<Group>(null);

  useLayoutEffect(() => {
    group.current?.traverse((part) => {
      part.castShadow = false;
    });
  });

  return <group ref={group}>{children}</group>;
}
