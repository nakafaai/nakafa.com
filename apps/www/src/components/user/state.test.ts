import { describe, expect, it } from "@effect/vitest";
import {
  patchUser,
  publicPictureFields,
  withoutBio,
} from "@/components/user/state";

const PHOTO = "https://lh3.example.test/ada.png";

describe("current user optimistic state", () => {
  it("copies the Google photo into the public account when the new picture shows it", () => {
    expect(publicPictureFields({ image: PHOTO }, "photo")).toEqual({
      image: PHOTO,
      picture: "photo",
    });
  });

  it("leaves the Google photo out of the public account while the animal shows", () => {
    const result = publicPictureFields({ image: PHOTO }, "animal");

    expect(result).toEqual({ picture: "animal" });
    expect("image" in result).toBe(false);
  });

  it("leaves the photo out when the account holds none", () => {
    expect(publicPictureFields({ image: null }, "photo")).toEqual({
      picture: "photo",
    });
  });

  it("patches a name without replacing other projection fields", () => {
    const user = { id: "user-1", name: "Ari" };
    const result = patchUser(user, { name: "Budi" });

    expect(result).toEqual({ id: "user-1", name: "Budi" });
    expect(user.name).toBe("Ari");
  });

  it("patches a role without replacing other app-user fields", () => {
    const user = { id: "user-1", role: "student" };
    const result = patchUser(user, { role: "teacher" });

    expect(result).toEqual({ id: "user-1", role: "teacher" });
    expect(user.role).toBe("student");
  });

  it("patches an address and a bio at once, and keeps the animal", () => {
    const user = {
      bio: "Hi",
      id: "user-1",
      mascot: "cat",
      username: "ari",
    };
    const result = patchUser(user, { bio: "Hello", username: "budi" });

    expect(result).toEqual({
      bio: "Hello",
      id: "user-1",
      mascot: "cat",
      username: "budi",
    });
    expect(user.username).toBe("ari");
  });

  it("leaves the bio out of the copy, so an empty bio is stored as no bio", () => {
    const user = { bio: "Hello", id: "user-1" };
    const result = withoutBio(user);

    expect(result).toEqual({ id: "user-1" });
    expect("bio" in result).toBe(false);
    expect(user.bio).toBe("Hello");
  });
});
