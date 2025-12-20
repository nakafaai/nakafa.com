"use client";

import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { SchoolClassesMaterialsNew } from "@/components/school/classes/materials/new";
import { SchoolClassesMaterialsSearch } from "@/components/school/classes/materials/search";
import { useClass } from "@/lib/context/use-class";

export function SchoolClassesMaterialsHeader() {
  return (
    <ButtonGroup className="w-full">
      <SchoolClassesMaterialsSearch />

      <SchoolClassesMaterialsHeaderAction />
    </ButtonGroup>
  );
}

function SchoolClassesMaterialsHeaderAction() {
  const classMembership = useClass((state) => state.classMembership);

  if (!classMembership) {
    return null;
  }

  if (classMembership.role === "teacher") {
    return <SchoolClassesMaterialsNew />;
  }

  return null;
}
