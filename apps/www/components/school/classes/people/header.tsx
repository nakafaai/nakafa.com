import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { SchoolClassesPeopleInvite } from "@/components/school/classes/people/invite";
import { SchoolClassesPeopleSearch } from "@/components/school/classes/people/search";
import { useClass } from "@/lib/context/use-class";

export function SchoolClassesPeopleHeader() {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <SchoolClassesPeopleSearch />

      <ButtonGroup>
        <SchoolClassesPeopleHeaderAction />
      </ButtonGroup>
    </div>
  );
}

function SchoolClassesPeopleHeaderAction() {
  const classMembership = useClass((state) => state.classMembership);

  if (!classMembership) {
    return null;
  }

  if (classMembership.role === "teacher") {
    return <SchoolClassesPeopleInvite />;
  }

  return null;
}
