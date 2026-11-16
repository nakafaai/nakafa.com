import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";

export const card = {
  name: "Tabs",
  group: "Content",
  height: 220,
  source: "tabs",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Tabs defaultValue="lesson">
        <TabsList>
          <TabsTab value="lesson">Lesson</TabsTab>
          <TabsTab value="exercises">Exercises</TabsTab>
          <TabsTab value="discussion">Discussion</TabsTab>
        </TabsList>
        <TabsPanel className="text-muted-foreground text-sm" value="lesson">
          Read the explanation, then try the exercises.
        </TabsPanel>
      </Tabs>
    </div>
  );
}
