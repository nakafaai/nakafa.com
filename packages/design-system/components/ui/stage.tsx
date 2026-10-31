import type { ReactNode } from "react";

/**
 * The page a drawer opens over, wrapping the whole app once at its root. On a phone, while a drawer is
 * open, the page scales back behind it as an iPhone sheet does; the design system's global styles draw
 * that from the open drawer's popup, so the stage holds no state and changes no value above streamed
 * content. It lives apart from the drawer, so the root's first JavaScript holds none of the drawer.
 */
export function DrawerStage({ children }: { children: ReactNode }) {
  return <div data-slot="drawer-stage">{children}</div>;
}
