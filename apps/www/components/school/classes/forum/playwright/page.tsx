"use client";

import { useSearchParams } from "next/navigation";
import { ConversationPlaywrightHarness } from "@/components/school/classes/forum/playwright/harness";

function getScenario(searchParams: ReturnType<typeof useSearchParams>) {
  const scenario = searchParams.get("scenario");

  if (scenario === "image" || scenario === "short") {
    return scenario;
  }

  return "long";
}

/** Resolves the browser harness scenario from the current URL query string. */
export function ConversationPlaywrightPage() {
  const searchParams = useSearchParams();

  return <ConversationPlaywrightHarness scenario={getScenario(searchParams)} />;
}
