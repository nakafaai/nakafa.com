import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";

export const card = {
  name: "VisualCard",
  group: "Content",
  height: 520,
  source: "components/visual/card",
};

/** A lesson visual: its title and sentence, the controls in the toolbar, the visual alone in the body, facts below. */
export function Preview() {
  return (
    <div className="max-w-xl p-6">
      <VisualCard>
        <VisualCardHeader
          description="Change the launch angle and watch the path."
          title="Projectile motion"
        />
        <VisualCardToolbar>
          <ToggleGroup
            aria-label="Launch angle"
            defaultValue="45"
            gridColumns="3"
            type="single"
            variant="outline"
          >
            <ToggleGroupItem value="30">30°</ToggleGroupItem>
            <ToggleGroupItem value="45">45°</ToggleGroupItem>
            <ToggleGroupItem value="60">60°</ToggleGroupItem>
          </ToggleGroup>
        </VisualCardToolbar>
        <VisualCardBody>
          <svg
            aria-label="A projectile's path"
            className="h-40 w-full"
            role="img"
            viewBox="0 0 300 120"
          >
            <path
              className="stroke-primary"
              d="M10 110 Q150 -40 290 110"
              fill="none"
              strokeWidth="3"
            />
            <line
              className="stroke-border"
              strokeWidth="1"
              x1="0"
              x2="300"
              y1="110"
              y2="110"
            />
          </svg>
        </VisualCardBody>
        <VisualCardFooter>
          <VisualCardFacts>
            <VisualFact label="Range" value="40.8 m" />
            <VisualFact label="Height" value="10.2 m" />
            <VisualFact label="Time" value="2.9 s" />
          </VisualCardFacts>
        </VisualCardFooter>
      </VisualCard>
    </div>
  );
}
