import { QueryResult, useQuery } from "@confect/react";
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
import { createDemoBackend } from "@/components/marketing/school/editor/backend";
import { DemoConvexClient } from "@/components/marketing/school/editor/client";
import { DEMO_SLUG, demoExam } from "@/components/marketing/school/editor/exam";
import { TenantContext } from "@/components/tenant/context";
import { ExamDesk } from "@/components/tenant/exams/editor";
import { ExamProvider } from "@/components/tenant/exams/provider";
import { ConvexAuthConfirmation, ConvexAuthContext } from "@/lib/auth/convex";
import { AuthSession } from "@/lib/auth/session";

/** The session the demo's editor is signed in under. It names no account: the demo's server answers every call. */
const DEMO_SESSION = "demo";

/** Convex's answer to the demo session: signed in. */
const DEMO_CONFIRMATION = ConvexAuthConfirmation.make({
  isAuthenticated: true,
  sessionId: DEMO_SESSION,
});

/** The exam's id and school, as the editor's read names them. */
const DEMO_EXAM = {
  examId: Schema.decodeUnknownSync(Id("exams"))("seedexam"),
  slug: Schema.decodeSync(TenantSlug)(DEMO_SLUG),
};

/**
 * The real School exam editor, on the School landing, over a demo school that lives in the page: the editor's own
 * header, toolbar, canvas, teacher's panel and footer, with a momentum question, a numeric one and an essay, in the
 * reader's language. Its Convex client answers every read and change from memory, so a visitor writes, sets the
 * key, the points and the scoring, adds and moves questions, zooms and opens the grid as a teacher does, and nothing
 * leaves the browser. It signs the editor in as a teacher of that school, inside this frame only.
 */
export function EditorDemo() {
  const t = useTranslations("SchoolSite");
  const [client] = useState(
    () =>
      new DemoConvexClient(
        createDemoBackend(
          demoExam({
            answer: t("demo-exam-answer"),
            essay: t.raw("demo-exam-essay"),
            explanation: t.raw("demo-exam-explanation"),
            numeric: t.raw("demo-exam-numeric"),
            question: t.raw("demo-exam-question"),
            rubric: t.raw("demo-exam-rubric"),
            title: t("demo-exam-title"),
          })
        )
      )
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
  // Convex's answer is known from the first render, the server's included, so the prerendered pages draw their
  // questions instead of empty paper while the section waits for its code.
  const [auth] = useState(() =>
    createStore(() => ({
      confirmation: Option.fromNullishOr(DEMO_CONFIRMATION),
    }))
  );

  return (
    <ConvexProvider client={client}>
      <AuthSessionContext value={session}>
        <ConvexAuthContext value={auth}>
          <DemoSchool>
            <DemoWorkspace />
          </DemoSchool>
        </ConvexAuthContext>
      </AuthSessionContext>
    </ConvexProvider>
  );
}

/** The demo school the editor belongs to, with a teacher's access to its exams. */
function DemoSchool({ children }: { children: ReactNode }) {
  const t = useTranslations("SchoolSite");

  return (
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
  );
}

/**
 * The editor's desk once the demo's server answers the exam, which it does in the first render, in a frame one
 * screen tall, so the canvas scrolls inside it as it does in a school.
 */
function DemoWorkspace() {
  const result = useQuery(exams.exams.open, DEMO_EXAM);

  return (
    <div
      className="bg-background ring-foreground/10 flex h-[min(46rem,85svh)] flex-col overflow-hidden rounded-xl shadow-xs ring-1"
      data-slot="editor-demo"
    >
      {QueryResult.isSuccess(result) ? (
        <ExamProvider exam={result.value} gone={false} slug={DEMO_EXAM.slug}>
          <ExamDesk />
        </ExamProvider>
      ) : null}
    </div>
  );
}
