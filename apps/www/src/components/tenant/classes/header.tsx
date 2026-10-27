import { Array as Arr } from "effect";
import { createContext, type ReactNode, use } from "react";
import type { BreadcrumbHeaderItem } from "@/components/shared/breadcrumb/header";
import { useClassScope } from "@/components/tenant/classes/scope";
import { ClassTabs } from "@/components/tenant/classes/tabs";
import type { ClassView } from "@/components/tenant/classes/view";
import { SchoolHeader } from "@/components/tenant/header";

/** The class page's path, its title, and its current tab. */
const ClassHeaderContext = createContext<{
  items: readonly BreadcrumbHeaderItem[];
  tab: (typeof ClassView.Type)["_tag"];
  title: string;
} | null>(null);

/** Gives the view of a resolved class page the path, the title, and the current tab that its header shows. */
export function ClassHeaderProvider({
  children,
  items,
  tab,
  title,
}: {
  children: ReactNode;
  items: readonly BreadcrumbHeaderItem[];
  tab: (typeof ClassView.Type)["_tag"];
  title: string;
}) {
  return (
    <ClassHeaderContext value={{ items, tab, title }}>
      {children}
    </ClassHeaderContext>
  );
}

/**
 * The top of a class page, one height on every view: the school header with the class's path and
 * the view's own actions, and the class's tabs under it. Each view composes its actions, so a list
 * keeps its search and its action beside the rows it reads.
 */
export function ClassHeader({ children }: { children?: ReactNode }) {
  const header = use(ClassHeaderContext);
  const { can, classSlug } = useClassScope();

  if (header === null) {
    throw new Error("ClassHeader must be used within a resolved class page");
  }

  return (
    <>
      <SchoolHeader items={header.items} title={header.title}>
        {children}
      </SchoolHeader>
      <ClassTabs
        canGrade={Arr.contains(can, "grade.list")}
        classSlug={classSlug}
        tab={header.tab}
      />
    </>
  );
}
