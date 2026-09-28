import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { ForumSessionProvider } from "@/components/school/classes/forum/session/context";
import { SchoolClassesHeaderInfo } from "@/components/school/classes/info";
import { SchoolClassesJoinForm } from "@/components/school/classes/join";
import { SchoolClassesTabs } from "@/components/school/classes/tabs";
import { SchoolClassesWorkspaceShell } from "@/components/school/classes/workspace";
import { ClassContextProvider } from "@/lib/school/classes/context";
import { getClassRouteSnapshot } from "@/lib/school/server";

/** Bind the authenticated class route to the class subtree. */
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
 * Resolve class admission and server data before rendering the client subtree.
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
  const route = await getClassRouteSnapshot(classId);

  if (!route) {
    notFound();
  }

  if (route.kind === "joinRequired") {
    return (
      <SchoolClassesJoinForm
        classId={route.class._id}
        visibility={route.class.visibility}
      />
    );
  }

  return (
    <ClassContextProvider initialRoute={route}>
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
