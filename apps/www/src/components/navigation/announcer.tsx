import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

/**
 * Reads each client navigation to assistive technology once the new page has
 * rendered. The first render stays silent, so a full page load announces
 * nothing.
 */
export function Announcer() {
  const router = useRouter();
  const [announcement, setAnnouncement] = useState("");
  const hasRendered = useRef(false);

  useEffect(
    () =>
      router.subscribe("onRendered", () => {
        if (!hasRendered.current) {
          hasRendered.current = true;
          return;
        }
        setAnnouncement(document.title);
      }),
    [router]
  );

  return (
    <div aria-live="polite" className="sr-only" role="status">
      {announcement}
    </div>
  );
}
