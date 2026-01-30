import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Erosi tanah akan semakin meningkat seiring meningkatnya deforestasi",
      value: false,
    },
    {
      label:
        "Deforestasi menyumbang hampir seluruh emisi gas rumah kaca di dunia",
      value: true,
    },
    {
      label:
        "Masyarakat yang menggunakan kayu bakar menjadi salah satu yang terdampak deforestasi",
      value: false,
    },
    {
      label:
        "Habitat satwa liar semakin terancam seiring terjadinya deforestasi",
      value: false,
    },
    {
      label:
        "Gas rumah kaca berdampak pada masyarakat yang menggantungkan hidupnya pada hutan",
      value: false,
    },
  ],
  en: [
    {
      label: "Soil erosion will increase as deforestation increases",
      value: false,
    },
    {
      label:
        "Deforestation contributes almost all of the world's greenhouse gas emissions",
      value: true,
    },
    {
      label:
        "Communities that use firewood are among those affected by deforestation",
      value: false,
    },
    {
      label:
        "Wildlife habitats are increasingly threatened as deforestation occurs",
      value: false,
    },
    {
      label: "Greenhouse gases affect communities that depend on forests",
      value: false,
    },
  ],
};

export default choices;
