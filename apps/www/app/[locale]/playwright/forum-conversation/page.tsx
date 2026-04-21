import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ConversationPlaywrightPage } from "@/components/school/classes/forum/playwright/page";

/** Renders the deterministic forum conversation browser harness outside production. */
export default function Page() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <ConversationPlaywrightPage />
    </Suspense>
  );
}
