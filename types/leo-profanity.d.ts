declare module "leo-profanity" {
  type DictionaryName = string;

  interface LeoProfanity {
    clean(input: string, replaceKey?: string, skipLetters?: number): string;
    check(input: string): boolean;
    list(dictionary?: DictionaryName): string[];
    add(data: string | string[]): LeoProfanity;
    remove(data: string | string[]): LeoProfanity;
    reset(): LeoProfanity;
    clearList(): LeoProfanity;
    loadDictionary(dictionary?: DictionaryName | DictionaryName[]): LeoProfanity;
    getDictionary(dictionary?: DictionaryName): string[];
    addDictionary(name: DictionaryName, words: string[]): LeoProfanity;
    removeDictionary(name: DictionaryName): LeoProfanity;
    badWordsUsed(input: string): string[];
  }

  const leoProfanity: LeoProfanity;
  export default leoProfanity;
}
