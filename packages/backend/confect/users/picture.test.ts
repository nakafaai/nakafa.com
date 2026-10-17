import { describe, expect, it } from "@effect/vitest";
import { photoOf } from "@repo/backend/confect/users/picture";

const PHOTO = "https://lh3.example.test/ada.png";

describe("users/picture", () => {
  it("shows the Google photo when the account chose it and holds one", () => {
    expect(photoOf({ image: PHOTO, picture: "photo" })).toBe(PHOTO);
  });

  it("shows no photo while the account keeps its animal", () => {
    expect(photoOf({ image: PHOTO, picture: "animal" })).toBeUndefined();
  });

  it("shows no photo for an account that never chose a picture", () => {
    expect(photoOf({ image: PHOTO })).toBeUndefined();
  });

  it("shows no photo when the account chose one it no longer holds", () => {
    expect(photoOf({ picture: "photo" })).toBeUndefined();
    expect(photoOf({ image: null, picture: "photo" })).toBeUndefined();
    expect(photoOf({ image: "", picture: "photo" })).toBeUndefined();
  });
});
