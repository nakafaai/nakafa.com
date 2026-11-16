import { Badge } from "@repo/design-system/components/ui/badge";

export const card = {
  name: "Badge",
  group: "Content",
  height: 190,
  source: "badge",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <div className="flex flex-wrap gap-2">
        <Badge>New</Badge>
        <Badge variant="secondary">Grade 10</Badge>
        <Badge variant="muted">12 lessons</Badge>
        <Badge variant="destructive">Closed</Badge>
        <Badge variant="outline">Draft</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="success">Joined</Badge>
        <Badge variant="warning">Invited</Badge>
        <Badge variant="info">In progress</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="default-subtle">Passed</Badge>
        <Badge variant="secondary-subtle">Merdeka</Badge>
        <Badge variant="muted-subtle">Archived</Badge>
        <Badge variant="destructive-subtle">Review</Badge>
      </div>
    </div>
  );
}
