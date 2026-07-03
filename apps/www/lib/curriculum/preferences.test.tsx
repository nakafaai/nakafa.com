import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferredCurriculumHref } from "@/lib/curriculum/preferences";

vi.mock("@repo/backend/helpers/react", () => ({
  useQueryWithStatus: vi.fn(),
}));

const useQueryWithStatusMock = vi.mocked(useQueryWithStatus);

function PreferenceProbe({
  onHref,
}: {
  onHref: (href: string | null) => void;
}) {
  onHref(usePreferredCurriculumHref("id"));

  return null;
}

describe("curriculum preferences", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    useQueryWithStatusMock.mockReturnValue({
      data: undefined,
      error: undefined,
      isError: false,
      isPending: true,
      isSuccess: false,
      status: "pending",
    });
  });

  it("loads the current preference instead of skipping behind a local auth gate", () => {
    const element = document.createElement("div");
    const root = createRoot(element);
    let href: string | null = "initial";
    function updateHref(value: string | null) {
      href = value;
    }

    act(() => {
      root.render(<PreferenceProbe onHref={updateHref} />);
    });

    expect(href).toBeNull();
    expect(useQueryWithStatusMock).toHaveBeenCalledWith(
      api.learningPreferences.queries.getCurrent,
      { locale: "id" }
    );

    act(() => {
      root.unmount();
    });
  });

  it("returns the localized curriculum href from the saved preference", () => {
    useQueryWithStatusMock.mockReturnValue({
      data: {
        preferredCurriculumProgramKey: "united-states",
        program: {
          countryCode: "US",
          key: "united-states",
          publicSlug: "amerika-serikat",
          title: "United States Standards-Aligned Pathway",
        },
      },
      error: undefined,
      isError: false,
      isPending: false,
      isSuccess: true,
      status: "success",
    });
    const element = document.createElement("div");
    const root = createRoot(element);
    let href: string | null = "initial";
    function updateHref(value: string | null) {
      href = value;
    }

    act(() => {
      root.render(<PreferenceProbe onHref={updateHref} />);
    });

    expect(href).toBe("/kurikulum/amerika-serikat");

    act(() => {
      root.unmount();
    });
  });
});
