import { useEffect, useLayoutEffect, useRef } from "react";

/** Saves the latest transcript scroll snapshot on page lifecycle exits. */
export function useScrollSave(saveCurrentScrollSnapshot: () => void) {
  const saveCurrentScrollSnapshotRef = useRef(saveCurrentScrollSnapshot);

  useLayoutEffect(() => {
    saveCurrentScrollSnapshotRef.current = saveCurrentScrollSnapshot;
  });

  useEffect(() => {
    const saveSnapshot = () => {
      saveCurrentScrollSnapshotRef.current();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") {
        return;
      }

      saveSnapshot();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", saveSnapshot);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", saveSnapshot);
    };
  }, []);

  useLayoutEffect(
    () => () => {
      saveCurrentScrollSnapshotRef.current();
    },
    []
  );
}
