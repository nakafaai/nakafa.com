import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";

export const card = {
  name: "NumberFormat",
  group: "Content",
  height: 130,
  source: "number-flow",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex items-end gap-10 p-6">
      <div>
        <p className="text-muted-foreground text-sm">Learners this month</p>
        <NumberFormat className="text-3xl font-semibold" value={128_450} />
      </div>
      <NumberFormatGroup>
        <div>
          <p className="text-muted-foreground text-sm">Average score</p>
          <NumberFormat
            className="text-3xl font-semibold"
            format={{ maximumFractionDigits: 1 }}
            value={712.4}
          />
        </div>
      </NumberFormatGroup>
    </div>
  );
}
