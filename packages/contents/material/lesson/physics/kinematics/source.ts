import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonPhysicsKinematicsMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/physics/kinematics",
  domain: "physics",
  key: "lesson.physics.kinematics",
  kind: "lesson",
  slug: "kinematics",
  translations: {
    en: {
      description:
        "Learn acceleration as the change in velocity over time through motion traces, velocity-time graphs, and simple calculations.",
      title: "Kinematics",
    },
    id: {
      description:
        "Pelajari percepatan sebagai perubahan kecepatan terhadap waktu melalui jejak gerak, grafik kecepatan-waktu, dan perhitungan sederhana.",
      title: "Kinematika",
    },
  },
  sections: [
    {
      slug: "acceleration",
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
