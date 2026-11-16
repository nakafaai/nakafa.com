import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";

export const card = {
  name: "ToggleGroup",
  group: "Actions",
  height: 150,
  source: "components/ui/toggle-group",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex max-w-lg flex-col gap-4 p-6">
      <ToggleGroup
        aria-label="Choose a cannonball path"
        defaultValue="sixty"
        gridColumns="3"
        type="single"
        variant="outline"
      >
        <ToggleGroupItem value="sixty">Sixty Degrees</ToggleGroupItem>
        <ToggleGroupItem value="long">Long Drive</ToggleGroupItem>
        <ToggleGroupItem value="high">High Arc</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup
        aria-label="Difficulty"
        defaultValue={["easy", "medium"]}
        type="multiple"
        variant="outline"
      >
        <ToggleGroupItem value="easy">Easy</ToggleGroupItem>
        <ToggleGroupItem value="medium">Medium</ToggleGroupItem>
        <ToggleGroupItem value="hard">Hard</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
