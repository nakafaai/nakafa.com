import {
  Source,
  SourceContent,
  SourceTrigger,
} from "@repo/design-system/components/ai/source";

export const card = {
  name: "Source",
  group: "Chat",
  height: 140,
  source: "components/ai/source",
};

/** A page Nina's answer cites, with its site, its title and, on a pointer's rest, its description. */
export function Preview() {
  return (
    <div className="flex max-w-xl flex-col gap-2 p-6">
      <Source href="https://nakafa.com/en/subject/high-school/10/mathematics">
        <SourceTrigger title="Quadratic functions" />
        <SourceContent description="Graphs, vertex form and roots, with worked examples." />
      </Source>
    </div>
  );
}
