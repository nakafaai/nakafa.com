import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { ForumSessionProvider } from "@/components/school/classes/forum/context/use-session";
import { SchoolClassesHeaderInfo } from "@/components/school/classes/info";
import { SchoolClassesJoinForm } from "@/components/school/classes/join-form";
import { SchoolClassesTabs } from "@/components/school/classes/tabs";
import { SchoolClassesWorkspaceShell } from "@/components/school/classes/workspace-shell";
import { ClassContextProvider } from "@/lib/context/use-class";
import { preloadClassRoute } from "@/lib/school/server";

/** Bind the preloaded class route to the class subtree. */
export default function Layout({
  children,
  panel,
  params,
}: {
  children: ReactNode;
  panel: ReactNode;
  params: LayoutProps<"/[locale]/school/[slug]/classes/[id]">["params"];
}) {
  return (
    <Suspense fallback={null}>
      <ResolvedClassRouteBoundary panel={panel} params={params}>
        {children}
      </ResolvedClassRouteBoundary>
    </Suspense>
  );
}

/** Resolve the class route params inside Suspense before loading class data. */
async function ResolvedClassRouteBoundary({
  children,
  panel,
  params,
}: {
  children: ReactNode;
  panel: ReactNode;
  params: LayoutProps<"/[locale]/school/[slug]/classes/[id]">["params"];
}) {
  const { id } = await params;

  return (
    <ClassRouteBoundary classId={id} panel={panel}>
      {children}
    </ClassRouteBoundary>
  );
}

/**
 * Preload the class route so the client subtree hydrates without a data gap.
 */
async function ClassRouteBoundary({
  children,
  classId,
  panel,
}: {
  children: ReactNode;
  classId: string;
  panel: ReactNode;
}) {
  const route = await preloadClassRoute({ classId });

  if (!route) {
    notFound();
  }

  const { preloaded, value } = route;

  if (value.kind === "joinRequired") {
    return (
      <SchoolClassesJoinForm
        classId={value.class._id}
        visibility={value.class.visibility}
      />
    );
  }

  return (
    <ClassContextProvider preloaded={preloaded}>
      <ForumSessionProvider classId={classId} key={classId}>
        <SchoolClassesWorkspaceShell panel={panel}>
          <SchoolClassesHeaderInfo />
          <SchoolClassesTabs />
          {children}
        </SchoolClassesWorkspaceShell>
      </ForumSessionProvider>
    </ClassContextProvider>
  );
}
