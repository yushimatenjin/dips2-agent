import countryData from "../data/country_codes.json" with { type: "json" };
import prefectureData from "../data/prefecture_codes.json" with { type: "json" };

export type CodeKind = "country" | "prefecture";

const COUNTRY_CODES = countryData.codes as Record<string, string>;
const PREFECTURE_CODES = prefectureData.codes as Record<string, string>;

function tableFor(kind: CodeKind): Record<string, string> {
  return kind === "country" ? COUNTRY_CODES : PREFECTURE_CODES;
}

export function lookupByCode(kind: CodeKind, code: string): string | null {
  return tableFor(kind)[code] ?? null;
}

export function lookupByName(kind: CodeKind, name: string): Array<{ code: string; name: string }> {
  const lower = name.toLowerCase();
  return Object.entries(tableFor(kind))
    .filter(([, n]) => n.toLowerCase().includes(lower))
    .map(([code, n]) => ({ code, name: n }));
}

export function tableSize(kind: CodeKind): number {
  return Object.keys(tableFor(kind)).length;
}
