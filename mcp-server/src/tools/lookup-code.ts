import { z } from "zod";
import { lookupByCode, lookupByName, tableSize, type CodeKind } from "../api/codes.js";

export const LookupCodeInputSchema = z
  .object({
    kind: z.enum(["country", "prefecture"]).describe("country: 国コード, prefecture: 都道府県コード"),
    code: z.string().optional().describe("コード値で名称を引く"),
    name: z.string().optional().describe("名称（部分一致、大小文字無視）でコードを引く"),
  })
  .refine((v) => !!v.code !== !!v.name, {
    message: "code または name のいずれか一方を指定（両方/両方なしは不可）",
  });

export type LookupCodeInput = z.infer<typeof LookupCodeInputSchema>;

export function lookupCodeTool(input: LookupCodeInput): string {
  const kind = input.kind as CodeKind;

  if (input.code) {
    const name = lookupByCode(kind, input.code);
    if (!name) return `${kind} コード "${input.code}" は登録表 (${tableSize(kind)}件) に見つかりません。`;
    return `${input.code} → ${name}`;
  }

  const matches = lookupByName(kind, input.name!);
  if (matches.length === 0) return `${kind} で "${input.name}" を含む名称は見つかりませんでした。`;
  if (matches.length === 1) return `${matches[0]!.name} → ${matches[0]!.code}`;

  const lines = [`"${input.name}" に一致 ${matches.length}件:`];
  for (const m of matches) lines.push(`  ${m.code}: ${m.name}`);
  return lines.join("\n");
}
