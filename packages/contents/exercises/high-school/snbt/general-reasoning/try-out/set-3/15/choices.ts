import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Pasti benar bahwa teh hijau mampu menghilangkan jerawat.",
      value: false,
    },
    {
      label:
        "Mungkin benar bahwa teh hijau jika dikonsumsi rutin dapat menjaga kesehatan kulit.",
      value: true,
    },
    {
      label: "Pasti salah bahwa teh hijau memiliki banyak manfaat.",
      value: false,
    },
    {
      label: "Mungkin salah bahwa teh hijau menghambat penuaan dini.",
      value: false,
    },
    {
      label:
        "Teh hijau tidak mampu mengurangi jerawat dan tidak menghambat penuaan dini.",
      value: false,
    },
  ],
  en: [
    {
      label: "It is definitely true that green tea can eliminate acne.",
      value: false,
    },
    {
      label:
        "It is possibly true that green tea, if consumed regularly, can maintain skin health.",
      value: true,
    },
    {
      label: "It is definitely false that green tea has many benefits.",
      value: false,
    },
    {
      label: "It is possibly false that green tea inhibits premature aging.",
      value: false,
    },
    {
      label:
        "Green tea cannot reduce acne and does not inhibit premature aging.",
      value: false,
    },
  ],
};

export default choices;
