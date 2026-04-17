import { fr } from "./fr";

export const dictionaries = {
  fr,
};

export type Locale = keyof typeof dictionaries;

export function getDictionary(locale: Locale = "fr") {
  return dictionaries[locale];
}