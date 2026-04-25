import {
  AIRCRAFT_STATUS_LABELS,
  AIRCRAFT_TYPE_LABELS,
  MANUFACTURING_CATEGORY_LABELS,
  REMODELING_LABELS,
  RID_TYPE_LABELS,
  WEIGHT_CLASSIFICATION_LABELS,
  type AircraftRecord,
} from "./types.js";

export function formatAircraftSummary(records: AircraftRecord[]): string {
  if (records.length === 0) {
    return "登録機体は見つかりませんでした。";
  }

  const lines: string[] = [];
  lines.push(`登録機体 ${records.length} 件`);
  lines.push("");

  records.forEach((record, idx) => {
    const a = record.aircraft_information;
    const status = AIRCRAFT_STATUS_LABELS[a.aircraft_status] ?? a.aircraft_status;
    const aircraftType = AIRCRAFT_TYPE_LABELS[a.aircraft_type] ?? a.aircraft_type;
    const ridType = RID_TYPE_LABELS[a.rid_type] ?? a.rid_type;

    lines.push(`[${idx + 1}] 登録記号: ${a.registration_code}  (${status})`);
    lines.push(`    製造者・型式: ${a.manufacturer_jpn} ${a.model_jpn}`);
    lines.push(`    製造番号: ${a.manufacturing_number}`);
    lines.push(`    機体種類: ${aircraftType}`);
    lines.push(`    重量: ${a.aircraft_weight}kg (最大離陸 ${a.maximum_takeoff_weight}kg, ${WEIGHT_CLASSIFICATION_LABELS[a.weight_classification] ?? ""})`);
    lines.push(`    寸法: ${a.aircraft_width}m × ${a.aircraft_length}m × ${a.aircraft_height}m`);
    lines.push(`    改造: ${REMODELING_LABELS[a.remodeling_type] ?? a.remodeling_type}${a.remodeling_summary ? ` (${a.remodeling_summary})` : ""}`);
    lines.push(`    リモートID: ${ridType}${a.rid_manufacturing_number ? ` / 製造番号 ${a.rid_manufacturing_number}` : ""}`);
    lines.push(`    有効期限: ${a.effectiveness_period_self} 〜 ${a.effectiveness_period_to}`);
    lines.push(`    所有者: ${record.owner_information.owner_fullname} (${record.owner_information.owner_email_address})`);
    lines.push(`    使用者: ${record.user_information.owner_user_same_confirmation === "1" ? "(所有者と同じ)" : record.user_information.user_fullname}`);
    lines.push(`    最終更新: ${a.last_update_date}`);
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

export function filterAircrafts(
  records: AircraftRecord[],
  filter: { serial?: string; registrationCode?: string; status?: "1" | "2" | "3"; modelContains?: string }
): AircraftRecord[] {
  return records.filter((r) => {
    const a = r.aircraft_information;
    if (filter.serial && a.manufacturing_number !== filter.serial) return false;
    if (filter.registrationCode && a.registration_code !== filter.registrationCode) return false;
    if (filter.status && a.aircraft_status !== filter.status) return false;
    if (filter.modelContains) {
      const haystack = `${a.manufacturer_jpn} ${a.model_jpn} ${a.manufacturer_eng} ${a.model_eng}`.toLowerCase();
      if (!haystack.includes(filter.modelContains.toLowerCase())) return false;
    }
    return true;
  });
}
