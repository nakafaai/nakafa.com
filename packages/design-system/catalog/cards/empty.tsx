import { Button } from "@repo/design-system/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { Nina } from "@repo/design-system/components/ui/nina";

export const card = {
  name: "Empty",
  group: "Feedback",
  height: 384,
  source: "components/ui/empty",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="p-6">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia>
            <Nina act="thinking" label="" size={96} whole />
          </EmptyMedia>
          <EmptyTitle>Start a new chat</EmptyTitle>
          <EmptyDescription>
            Ask Nina about any lesson, exercise, or exam question.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline">Browse subjects</Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
