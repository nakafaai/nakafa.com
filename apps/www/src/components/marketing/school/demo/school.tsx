import { useQuery } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { schoolMascot } from "@repo/backend/confect/tenancy/mascot";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { ConvexProvider } from "convex/react";
import { Option, Schema } from "effect";
import { type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";
import { createStore } from "zustand";
import { AuthSessionContext } from "@/components/auth/context";
import { createDemoBackend } from "@/components/marketing/school/demo/backend";
import { DemoConvexClient } from "@/components/marketing/school/demo/client";
import {
  DEMO_EXAM_ID,
  DEMO_SLUG,
} from "@/components/marketing/school/demo/seed";
import { TenantContext } from "@/components/tenant/context";
import { ConvexAuthConfirmation, ConvexAuthContext } from "@/lib/auth/convex";
import { AuthSession } from "@/lib/auth/session";

/** The session the demo is signed in under. It names no account: the demo's server answers every call. */
const DEMO_SESSION = "demo";

/** Convex's answer to the demo session: signed in. */
const DEMO_CONFIRMATION = ConvexAuthConfirmation.make({
  isAuthenticated: true,
  sessionId: DEMO_SESSION,
});

/** The exam's id and school, as the School's reads name them. */
export const DEMO_EXAM = {
  examId: Schema.decodeUnknownSync(Id("exams"))(DEMO_EXAM_ID),
  slug: Schema.decodeSync(TenantSlug)(DEMO_SLUG),
};

/**
 * A demo school that lives in the page, for the School's own screens on the School landing: a Convex client that
 * answers every read and change of one exam from memory, a session signed in as a teacher of that school, and the
 * school itself. Nothing leaves the browser, and the session holds inside this frame only. Convex's answer is known
 * from the first render, the server's included, so a prerendered page draws the exam's questions instead of empty
 * paper while the section waits for its code.
 */
export function DemoSchool({
  children,
  seed,
}: {
  children: ReactNode;
  /** The exam the demo's server starts with, and the texts of its questions. */
  seed: Parameters<typeof createDemoBackend>[0];
}) {
  const t = useTranslations("SchoolSite");
  const [client] = useState(
    () => new DemoConvexClient(createDemoBackend(seed))
  );
  const [session] = useState(() =>
    createStore(() =>
      AuthSession.make({
        hasError: false,
        isPending: false,
        sessionId: DEMO_SESSION,
        userId: DEMO_SESSION,
      })
    )
  );
  const [auth] = useState(() =>
    createStore(() => ({
      confirmation: Option.fromNullishOr(DEMO_CONFIRMATION),
    }))
  );

  return (
    <ConvexProvider client={client}>
      <AuthSessionContext value={session}>
        <ConvexAuthContext value={auth}>
          <TenantContext
            value={{
              canManage: false,
              canOpenExams: true,
              canOpenGraduation: false,
              canOpenInsight: false,
              canOpenReports: false,
              home: { canCreate: false, canWatch: false, choices: [] },
              logo: undefined,
              mascot: schoolMascot(DEMO_SLUG),
              name: t("breadcrumb"),
              reach: [],
              role: Option.some("teacher"),
              slug: DEMO_EXAM.slug,
            }}
          >
            {children}
          </TenantContext>
        </ConvexAuthContext>
      </AuthSessionContext>
    </ConvexProvider>
  );
}

/** Reads the demo school's exam, which its server answers in the first render. */
export function useDemoExam() {
  return useQuery(exams.exams.open, DEMO_EXAM);
}
