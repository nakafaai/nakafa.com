/** Pure camera projection contract shared by view math and React renderers. */
export type CameraProjection =
  | {
      readonly far?: number;
      readonly fov?: number;
      readonly kind: "perspective";
      readonly near?: number;
    }
  | {
      readonly far?: number;
      readonly kind: "orthographic";
      readonly near?: number;
      readonly viewHeight: number;
    };
