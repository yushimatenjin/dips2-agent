import { z } from "zod";
import type { DipsConfig } from "../config.js";
import { fetchAircrafts } from "../api/client.js";
import { filterAircrafts, formatAircraftSummary } from "../api/format.js";

export const ListAircraftsInputSchema = z.object({
  serial: z.string().optional().describe("製造番号で絞り込み（完全一致）"),
  registrationCode: z.string().optional().describe("登録記号で絞り込み（完全一致、12桁）"),
  status: z.enum(["1", "2", "3"]).optional().describe("1: 有効, 2: 期限切れ, 3: 抹消済"),
  modelContains: z.string().optional().describe("製造者名・型式名に含まれる文字列（部分一致、大小文字無視）"),
  format: z.enum(["summary", "json"]).optional().describe("出力形式 (default: summary)"),
});

export type ListAircraftsInput = z.infer<typeof ListAircraftsInputSchema>;

export async function listAircraftsTool(config: DipsConfig, input: ListAircraftsInput): Promise<string> {
  const all = await fetchAircrafts(config);
  const filtered = filterAircrafts(all, input);
  const format = input.format ?? "summary";

  if (format === "json") {
    return JSON.stringify(filtered, null, 2);
  }
  return formatAircraftSummary(filtered);
}
