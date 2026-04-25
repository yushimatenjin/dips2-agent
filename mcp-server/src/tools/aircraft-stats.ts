import type { DipsConfig } from "../config.js";
import { fetchAircrafts } from "../api/client.js";
import {
  AIRCRAFT_STATUS_LABELS,
  AIRCRAFT_TYPE_LABELS,
  MANUFACTURING_CATEGORY_LABELS,
  REMODELING_LABELS,
  RID_TYPE_LABELS,
  WEIGHT_CLASSIFICATION_LABELS,
} from "../api/types.js";

export async function aircraftStatsTool(config: DipsConfig): Promise<string> {
  const records = await fetchAircrafts(config);
  const total = records.length;
  if (total === 0) return "登録機体は0件です。";

  const tally = (extract: (r: typeof records[number]) => string, labels: Record<string, string>) => {
    const counts = new Map<string, number>();
    for (const r of records) {
      const k = extract(r);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([k, n]) => `  ${labels[k] ?? k}: ${n}`)
      .join("\n");
  };

  const lines: string[] = [];
  lines.push(`登録機体総数: ${total}件`);
  lines.push("");
  lines.push("【ステータス別】");
  lines.push(tally((r) => r.aircraft_information.aircraft_status, AIRCRAFT_STATUS_LABELS));
  lines.push("");
  lines.push("【機体種類別】");
  lines.push(tally((r) => r.aircraft_information.aircraft_type, AIRCRAFT_TYPE_LABELS));
  lines.push("");
  lines.push("【重量区分別】");
  lines.push(tally((r) => r.aircraft_information.weight_classification, WEIGHT_CLASSIFICATION_LABELS));
  lines.push("");
  lines.push("【リモートID搭載】");
  lines.push(tally((r) => r.aircraft_information.rid_type, RID_TYPE_LABELS));
  lines.push("");
  lines.push("【改造】");
  lines.push(tally((r) => r.aircraft_information.remodeling_type, REMODELING_LABELS));
  lines.push("");
  lines.push("【製造区分】");
  lines.push(tally((r) => r.aircraft_information.manufacturing_category, MANUFACTURING_CATEGORY_LABELS));
  lines.push("");

  const today = Date.now();
  const expiringSoon = records.filter((r) => {
    const t = Date.parse(r.aircraft_information.effectiveness_period_to);
    if (Number.isNaN(t)) return false;
    return t - today <= 30 * 24 * 3600 * 1000 && t - today > 0;
  }).length;
  const expired = records.filter((r) => {
    const t = Date.parse(r.aircraft_information.effectiveness_period_to);
    return !Number.isNaN(t) && t - today <= 0 && r.aircraft_information.aircraft_status === "1";
  }).length;
  lines.push("【有効期限】");
  lines.push(`  30日以内に期限切れ: ${expiringSoon}件`);
  lines.push(`  期限切れ間近・要更新: ${expired}件 (ステータスは有効のまま)`);

  return lines.join("\n");
}
