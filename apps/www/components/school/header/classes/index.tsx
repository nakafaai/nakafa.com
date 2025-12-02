import { SchoolHeaderClassesAdd } from "@/components/school/header/classes/add";
import { SchoolHeaderClassesSearch } from "@/components/school/header/classes/search";

export function SchoolHeaderClasses() {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <SchoolHeaderClassesSearch />
      <SchoolHeaderClassesAdd />
    </div>
  );
}
