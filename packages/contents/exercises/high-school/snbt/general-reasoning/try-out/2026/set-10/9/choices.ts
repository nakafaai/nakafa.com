import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Jika terjadi kenaikan tarif angkutan umum maka terjadi kenaikan harga bahan bakar minyak (BBM)",
      value: false,
    },
    {
      label:
        "Jika tidak ada kenaikan tarif angkutan umum maka tidak terjadi kenaikan harga bahan bakar minyak (BBM)",
      value: true,
    },
    {
      label:
        "Jika terjadi kenaikan harga kebutuhan pokok maka telah terjadi kenaikan harga bahan bakar minyak (BBM)",
      value: false,
    },
    {
      label:
        "Setiap kenaikan harga bahan bakar minyak (BBM) maka tidak terjadi kenaikan harga kebutuhan pokok",
      value: false,
    },
    {
      label:
        "Jika tidak terjadi kenaikan harga bahan bakar minyak (BBM) maka tidak terjadi kenaikan harga kebutuhan pokok",
      value: false,
    },
  ],
  en: [
    {
      label:
        "If there is an increase in public transportation fares, then there is an increase in fuel (BBM) prices",
      value: false,
    },
    {
      label:
        "If there is no increase in public transportation fares, then there is no increase in fuel (BBM) prices",
      value: true,
    },
    {
      label:
        "If there is an increase in the prices of basic needs, then there has been an increase in fuel (BBM) prices",
      value: false,
    },
    {
      label:
        "Every increase in fuel (BBM) prices results in no increase in the prices of basic needs",
      value: false,
    },
    {
      label:
        "If there is no increase in fuel (BBM) prices, then there is no increase in the prices of basic needs",
      value: false,
    },
  ],
};

export default choices;
