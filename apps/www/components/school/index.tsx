import { HttpClient } from "@confect/js";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect } from "effect";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { env } from "@/env";
import { getToken } from "@/lib/auth/server";

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
          HttpClient.layer(env.NEXT_PUBLIC_CONVEX_URL, {
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
