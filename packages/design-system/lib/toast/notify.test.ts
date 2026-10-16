import { afterEach, describe, expect, it } from "@effect/vitest";
import { toast } from "@repo/design-system/lib/toast/notify";
import { toast as sonner } from "sonner";

vi.mock("sonner", () => ({
  toast: Object.assign(
    vi.fn(() => "shown"),
    {
      dismiss: vi.fn(),
      error: vi.fn(() => "failed"),
      info: vi.fn(() => "info"),
      success: vi.fn(() => "done"),
    }
  ),
}));

afterEach(() => vi.clearAllMocks());

describe("toast", () => {
  it("shows a failure and a success with the place and the id they are given", () => {
    toast.error("Could not save.", { id: "save", position: "bottom-center" });
    toast.success("Saved.", { id: "save", position: "bottom-center" });

    expect(sonner.error).toHaveBeenCalledExactlyOnceWith("Could not save.", {
      id: "save",
      position: "bottom-center",
    });
    expect(sonner.success).toHaveBeenCalledExactlyOnceWith("Saved.", {
      id: "save",
      position: "bottom-center",
    });
  });

  it("shows information with its own kind, not as a failure", () => {
    toast.info("Refreshing.");

    expect(sonner.info).toHaveBeenCalledExactlyOnceWith(
      "Refreshing.",
      undefined
    );
    expect(sonner.error).not.toHaveBeenCalled();
  });

  it("returns the id of a plain toast, so that its action can close it later", () => {
    const action = { label: "Undo", onClick: () => undefined };

    const id = toast.message("Deleted.", { action, duration: 5000 });

    expect(id).toBe("shown");
    expect(sonner).toHaveBeenCalledExactlyOnceWith("Deleted.", {
      action,
      duration: 5000,
    });
  });

  it("closes the toast with the id it is given, or every toast without one", () => {
    toast.dismiss("shown");
    toast.dismiss();

    expect(sonner.dismiss).toHaveBeenNthCalledWith(1, "shown");
    expect(sonner.dismiss).toHaveBeenNthCalledWith(2, undefined);
  });
});
