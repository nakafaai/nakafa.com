import { notFound } from "next/navigation";
import { use } from "react";
import { SchoolClassesHeaderInfo } from "@/components/school/classes/info";
import { SchoolClassesJoinForm } from "@/components/school/classes/join-form";
import { SchoolClassesTabs } from "@/components/school/classes/tabs";
import { SchoolClassesWorkspaceShell } from "@/components/school/classes/workspace-shell";
import { ClassContextProvider } from "@/lib/context/use-class";
import { ForumContextProvider } from "@/lib/context/use-forum";
import { getClassRouteSnapshot } from "@/lib/school/server";

/** Bind the resolved class route snapshot to the class subtree. */
export default function Layout(
  props: LayoutProps<"/[locale]/school/[slug]/classes/[id]">
) {
  const { children, panel, params } = props;
  const { id } = use(params);

  return (
    <ClassRouteBoundary classId={id} panel={panel}>
      {children}
    </ClassRouteBoundary>
  );
}

type ClassLayoutSlots = Pick<
  LayoutProps<"/[locale]/school/[slug]/classes/[id]">,
  "children" | "panel"
>;

/**
 * Resolve the class route snapshot on the server so the client subtree only
 * consumes stable class state.
 */
async function ClassRouteBoundary({
  children,
  classId,
  panel,
}: ClassLayoutSlots & {
  classId: string;
}) {
  const value = await getClassRouteSnapshot({ classId });

  if (!value) {
    notFound();
  }

  if (value.kind === "joinRequired") {
    return (
      <SchoolClassesJoinForm
        classId={value.class._id}
        visibility={value.class.visibility}
      />
    );
  }

  return (
    <ClassContextProvider value={value}>
      <ForumContextProvider key={classId}>
        <SchoolClassesWorkspaceShell panel={panel}>
          <SchoolClassesHeaderInfo />
          <SchoolClassesTabs />
          {children}
        </SchoolClassesWorkspaceShell>
      </ForumContextProvider>
    </ClassContextProvider>
  );
}
