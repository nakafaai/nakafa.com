import { Nina } from "@repo/design-system/components/ui/nina";

export const card = {
  name: "Nina",
  group: "Identity",
  height: 340,
  source: "nina",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="grid gap-6 p-6">
      <div className="flex flex-wrap items-end gap-4">
        <Nina act="waving" size={120} whole />
        <Nina act="reading" size={120} whole />
        <Nina act="juggling" size={120} whole />
        <Nina act="sleeping" size={120} whole />
      </div>
      <div className="flex flex-wrap items-end gap-6">
        <Nina act="greeting" lean="peek" size={96} />
        <Nina act="drumming" lean="peek" size={96} />
        <Nina act="gripping" size={96} tile="yellow" />
        <Nina act="greeting" size={96} tile="blue" />
      </div>
    </div>
  );
}
