import { Image } from "@repo/design-system/components/image";

const picture =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'><rect width='160' height='90' fill='%23e3f6fe'/><circle cx='120' cy='28' r='14' fill='%23f1cd1f'/><path d='M0 90 L50 40 L90 75 L120 55 L160 90 Z' fill='%2358904d'/></svg>";

export const card = {
  name: "Image",
  group: "Content",
  height: 240,
  source: "components/image",
};

/** A picture with its size written in the markup, so the page keeps its room before the file arrives. */
export function Preview() {
  return (
    <div className="p-6">
      <Image
        alt="A hill under the sun"
        className="rounded-xl border"
        height={180}
        src={picture}
        width={320}
      />
    </div>
  );
}
