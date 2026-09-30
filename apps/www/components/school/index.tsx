import { HttpClient } from "@confect/js";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect } from "effect";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getToken } from "@/lib/auth/server";
import { httpLayer } from "@/lib/convex/http";

/** Resolves the authenticated school landing redirects before rendering children. */
export async function School({
  children,
  locale,
}: {
  children: ReactNode;
  locale: string;
}) {
  const token = await getToken();
  if (token) {
    const landingState = await Effect.runPromise(
      Effect.flatMap(HttpClient.HttpClient, (client) =>
        client.query(refs.public.schools.queries.getMySchoolLandingState, {})
      ).pipe(
        Effect.provide(
          httpLayer({
            auth: token,
          })
        ),
        Effect.withTracerTiming(false)
      )
    );
    if (landingState.kind === "none") {
      redirect(`/${locale}/school/onboarding`);
    }
    if (landingState.kind === "single") {
      redirect(`/${locale}/school/${landingState.slug}`);
    }
    if (landingState.kind === "multiple") {
      redirect(`/${locale}/school/select`);
    }
  }
  return children;
}
