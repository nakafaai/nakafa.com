import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonPhysicsKinematicsMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/physics/kinematics",
  domain: "physics",
  key: "lesson.physics.kinematics",
  kind: "lesson",
  slug: "kinematics",
  routeSlugs: { en: "kinematics", id: "kinematika" },
  translations: {
    en: {
      description: "Read acceleration from traces and velocity graphs.",
      title: "Kinematics",
    },
    id: {
      description: "Baca percepatan dari jejak gerak dan grafik kecepatan.",
      title: "Kinematika",
    },
  },
  sections: [
    {
      slug: "acceleration",
      routeSlugs: { en: "acceleration", id: "percepatan" },
      translations: {
        en: {
          title: "Acceleration",
        },
        id: {
          title: "Percepatan",
        },
      },
    },
    {
      slug: "average-velocity-speed",
      routeSlugs: {
        en: "average-velocity-speed",
        id: "kecepatan-dan-kelajuan-rata-rata",
      },
      translations: {
        en: {
          title: "Average Velocity and Average Speed",
        },
        id: {
          title: "Kecepatan dan Kelajuan Rata-Rata",
        },
      },
    },
    {
      slug: "displacement-distance",
      routeSlugs: { en: "displacement-distance", id: "perpindahan-dan-jarak" },
      translations: {
        en: {
          title: "Displacement and Distance",
        },
        id: {
          title: "Perpindahan dan Jarak",
        },
      },
    },
    {
      slug: "instantaneous-velocity-speed",
      routeSlugs: {
        en: "instantaneous-velocity-speed",
        id: "kecepatan-dan-kelajuan-sesaat",
      },
      translations: {
        en: {
          title: "Instantaneous Velocity and Speed",
        },
        id: {
          title: "Kecepatan dan Kelajuan Sesaat",
        },
      },
    },
    {
      slug: "movement-position-change",
      routeSlugs: {
        en: "movement-position-change",
        id: "gerak-sebagai-perubahan-posisi",
      },
      translations: {
        en: {
          title: "Motion as a Change in Position",
        },
        id: {
          title: "Gerak sebagai Perubahan Posisi",
        },
      },
    },
    {
      slug: "non-uniform-linear-motion",
      routeSlugs: {
        en: "non-uniform-linear-motion",
        id: "gerak-lurus-berubah-beraturan",
      },
      translations: {
        en: {
          title: "Uniformly Accelerated Linear Motion",
        },
        id: {
          title: "Gerak Lurus Berubah Beraturan",
        },
      },
    },
    {
      slug: "parabolic-movement",
      routeSlugs: { en: "parabolic-movement", id: "gerak-parabola" },
      translations: {
        en: {
          title: "Projectile Motion",
        },
        id: {
          title: "Gerak Parabola",
        },
      },
    },
    {
      slug: "parabolic-movement-analysis",
      routeSlugs: {
        en: "parabolic-movement-analysis",
        id: "analisis-gerak-parabola",
      },
      translations: {
        en: {
          title: "Projectile Motion Analysis",
        },
        id: {
          title: "Analisis Gerak Parabola",
        },
      },
    },
    {
      slug: "reference-frame-position",
      routeSlugs: {
        en: "reference-frame-position",
        id: "kerangka-acuan-dan-posisi",
      },
      translations: {
        en: {
          title: "Reference Frame and Position",
        },
        id: {
          title: "Kerangka Acuan dan Posisi",
        },
      },
    },
    {
      slug: "relative-movement",
      routeSlugs: { en: "relative-movement", id: "gerak-relatif" },
      translations: {
        en: {
          title: "Relative Motion",
        },
        id: {
          title: "Gerak Relatif",
        },
      },
    },
    {
      slug: "stopping-distance",
      routeSlugs: { en: "stopping-distance", id: "jarak-henti" },
      translations: {
        en: {
          title: "Stopping Distance",
        },
        id: {
          title: "Jarak Henti",
        },
      },
    },
    {
      slug: "uniform-circular-motion",
      routeSlugs: {
        en: "uniform-circular-motion",
        id: "gerak-melingkar-beraturan",
      },
      translations: {
        en: {
          title: "Uniform Circular Motion",
        },
        id: {
          title: "Gerak Melingkar Beraturan",
        },
      },
    },
    {
      slug: "uniform-linear-motion",
      routeSlugs: { en: "uniform-linear-motion", id: "gerak-lurus-beraturan" },
      translations: {
        en: {
          title: "Uniform Linear Motion",
        },
        id: {
          title: "Gerak Lurus Beraturan",
        },
      },
    },
    {
      slug: "velocity-speed",
      routeSlugs: { en: "velocity-speed", id: "kecepatan-dan-kelajuan" },
      translations: {
        en: {
          title: "Velocity and Speed",
        },
        id: {
          title: "Kecepatan dan Kelajuan",
        },
      },
    },
    {
      slug: "vertical-movement",
      routeSlugs: { en: "vertical-movement", id: "gerak-vertikal" },
      translations: {
        en: {
          title: "Vertical Motion",
        },
        id: {
          title: "Gerak Vertikal",
        },
      },
    },
  ],
});
