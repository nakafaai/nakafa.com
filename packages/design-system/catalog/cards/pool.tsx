import { Pool } from "@repo/design-system/components/pool/scene";

export const card = {
  name: "Pool",
  group: "Identity",
  height: 360,
  source: "components/pool/scene",
};

/** The pool of animals on the sign-in page: they pile up, hop when a pointer nears, and can be thrown. */
export function Preview() {
  return (
    <div className="h-80 p-6">
      <Pool />
    </div>
  );
}
