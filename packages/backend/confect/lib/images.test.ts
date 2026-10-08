import { describe, expect, it } from "@effect/vitest";
import { schoolClassImageValidator } from "@repo/backend/confect/classes/schema";
import {
  CLASS_IMAGE_ENTRIES,
  getClassImageUrl,
  getRandomClassImage,
  isValidClassImage,
} from "@repo/backend/confect/lib/images";
import { HashMap, Option } from "effect";

const CLASS_IMAGE_URL_PATTERN = /^\/classes\/[a-z]+\.png$/;
const CLASS_IMAGES = HashMap.fromIterable(CLASS_IMAGE_ENTRIES);

describe("lib/images", () => {
  it.each(schoolClassImageValidator.literals)(
    "resolves the registered asset for validated image %s",
    (image) => {
      expect(isValidClassImage(image)).toBe(true);
      expect(getClassImageUrl(image)).toBe(
        Option.getOrUndefined(HashMap.get(CLASS_IMAGES, image))
      );
      expect(getClassImageUrl(image)).toMatch(CLASS_IMAGE_URL_PATTERN);
    }
  );

  it.each([
    "",
    "Algebra 1",
    "Kelas Matematika",
    "数学",
    "🧪 Science",
    "a".repeat(1000),
  ])("keeps repeated assignment stable and valid for %j", (name) => {
    const image = getRandomClassImage(name);
    expect(getRandomClassImage(name)).toBe(image);
    expect(isValidClassImage(image)).toBe(true);
  });

  it("preserves the empty-name default and distinguishes ordered class names", () => {
    expect(getRandomClassImage("")).toBe("retro");
    expect(getRandomClassImage("ab")).not.toBe(getRandomClassImage("ba"));
  });
});
