import { useIntersection } from "@mantine/hooks";
import { type ReactNode, useState } from "react";

/**
 * The founder's note as it comes on screen. Once a third of it shows, it is
 * marked as seen for good, so the highlighter sweeps over the promise and the
 * signature writes itself once, and never again while the page stays open.
 */
export function LetterSheet({ children }: { children: ReactNode }) {
  const { entry, ref } = useIntersection({ threshold: 0.35 });
  const [seen, setSeen] = useState(false);

  // Seen is remembered from an earlier render, so the note never un-writes
  // itself when it scrolls away.
  if (!seen && (entry?.isIntersecting ?? false)) {
    setSeen(true);
  }

  return (
    <div className="group/letter" data-seen={seen ? "" : undefined} ref={ref}>
      {children}
    </div>
  );
}
