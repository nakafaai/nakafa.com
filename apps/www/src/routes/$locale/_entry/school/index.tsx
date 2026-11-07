import { createFileRoute } from "@tanstack/react-router";
import { EntryShellBody, EntryShellHeader } from "@/components/entry/shell";
import { ThemePicker } from "@/components/shared/theme/picker";
import { SchoolEntry } from "@/components/tenant/start/entry";

/**
 * Where School leads from the home page. It renders only in the browser and asks the
 * server nothing, because it knows the account from Convex and the kept schools.
 */
export const Route = createFileRoute("/$locale/_entry/school/")({
  ssr: false,
  head: () => ({ meta: [{ content: "noindex", name: "robots" }] }),
  component: SchoolEntryPage,
});

function SchoolEntryPage() {
  return (
    <>
      <EntryShellHeader>
        <div className="ms-auto">
          <ThemePicker variant="ghost" />
        </div>
      </EntryShellHeader>
      <EntryShellBody>
        <SchoolEntry />
      </EntryShellBody>
    </>
  );
}
