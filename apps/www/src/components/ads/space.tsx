import type { ReactNode, Ref } from "react";

/**
 * The room of one ad frame between two sections, at the frame's full height.
 * The page's HTML holds it empty, so the frame fills it without moving the text
 * below it, and an ad that never comes leaves the room as it stood.
 */
export function AdSpace({
  children,
  ref,
}: {
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div className="my-8 h-100" ref={ref}>
      {children}
    </div>
  );
}
