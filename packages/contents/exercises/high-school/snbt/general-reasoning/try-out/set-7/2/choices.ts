import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Gigi yang tidak rutin dibersihkan dapat membentuk karang gigi.",
      value: false,
    },
    {
      label: "Karang gigi yang menumpuk dapat menyebabkan gingivitis.",
      value: false,
    },
    {
      label:
        "Sisa makanan yang menumpuk di permukaan gigi berpotensi membentuk karang gigi.",
      value: false,
    },
    {
      label:
        "Nyeri dan bengkak di gusi selalu disebabkan oleh sisa makanan yang menumpuk.",
      value: true,
    },
    {
      label: "Infeksi gusi terjadi karena adanya penumpukan karang gigi.",
      value: false,
    },
  ],
  en: [
    {
      label: "Teeth that are not routinely cleaned can form tartar.",
      value: false,
    },
    { label: "Accumulated tartar can cause gingivitis.", value: false },
    {
      label:
        "Food leftovers accumulating on the tooth surface have the potential to form tartar.",
      value: false,
    },
    {
      label:
        "Pain and swelling in the gums are always caused by accumulated food leftovers.",
      value: true,
    },
    {
      label: "Gum infection occurs due to the accumulation of tartar.",
      value: false,
    },
  ],
};

export default choices;
