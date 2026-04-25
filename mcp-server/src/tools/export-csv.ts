import { z } from "zod";
import type { DipsConfig } from "../config.js";
import { fetchAircrafts } from "../api/client.js";
import { filterAircrafts } from "../api/format.js";
import {
  AIRCRAFT_STATUS_LABELS,
  AIRCRAFT_TYPE_LABELS,
  REMODELING_LABELS,
  RID_TYPE_LABELS,
  WEIGHT_CLASSIFICATION_LABELS,
} from "../api/types.js";

export const ExportCsvInputSchema = z.object({
  serial: z.string().optional(),
  registrationCode: z.string().optional(),
  status: z.enum(["1", "2", "3"]).optional(),
  modelContains: z.string().optional(),
  includeBom: z.boolean().optional().describe("Excel互換用にUTF-8 BOMを付ける (default: true)"),
});

export type ExportCsvInput = z.infer<typeof ExportCsvInputSchema>;

const COLUMNS = [
  "登録記号",
  "製造番号",
  "製造者",
  "型式",
  "機体種類",
  "機体重量(kg)",
  "最大離陸重量(kg)",
  "全幅(m)",
  "全長(m)",
  "全高(m)",
  "重量区分",
  "改造",
  "リモートID",
  "RID製造番号",
  "ステータス",
  "有効期限(自)",
  "有効期限(至)",
  "所有者氏名",
  "所有者メール",
  "使用者氏名",
  "最終更新日",
];

function csvEscape(value: string): string {
  const needsQuote = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

export async function exportCsvTool(config: DipsConfig, input: ExportCsvInput): Promise<string> {
  const all = await fetchAircrafts(config);
  const filtered = filterAircrafts(all, input);
  const includeBom = input.includeBom ?? true;

  const rows: string[] = [];
  rows.push(COLUMNS.map(csvEscape).join(","));

  for (const r of filtered) {
    const a = r.aircraft_information;
    const userName =
      r.user_information.owner_user_same_confirmation === "1"
        ? r.owner_information.owner_fullname
        : r.user_information.user_fullname;

    const cells = [
      a.registration_code,
      a.manufacturing_number,
      a.manufacturer_jpn,
      a.model_jpn,
      AIRCRAFT_TYPE_LABELS[a.aircraft_type] ?? a.aircraft_type,
      a.aircraft_weight,
      a.maximum_takeoff_weight,
      a.aircraft_width,
      a.aircraft_length,
      a.aircraft_height,
      WEIGHT_CLASSIFICATION_LABELS[a.weight_classification] ?? a.weight_classification,
      REMODELING_LABELS[a.remodeling_type] ?? a.remodeling_type,
      RID_TYPE_LABELS[a.rid_type] ?? a.rid_type,
      a.rid_manufacturing_number ?? "",
      AIRCRAFT_STATUS_LABELS[a.aircraft_status] ?? a.aircraft_status,
      a.effectiveness_period_self,
      a.effectiveness_period_to,
      r.owner_information.owner_fullname,
      r.owner_information.owner_email_address,
      userName,
      a.last_update_date,
    ].map((v) => csvEscape(String(v ?? "")));
    rows.push(cells.join(","));
  }

  const csv = rows.join("\r\n");
  return includeBom ? "\uFEFF" + csv : csv;
}
