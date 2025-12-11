"use client";

import { useEffect } from "react";
import { useForum } from "@/lib/context/use-forum";

export function SchoolClassesForumPostSheetError() {
  const setActiveForumId = useForum((state) => state.setActiveForumId);
  useEffect(() => {
    setActiveForumId(null);
  }, [setActiveForumId]);

  return null;
}
