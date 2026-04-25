import { z } from "zod";
import type { DipsConfig } from "../config.js";
import { fetchAircrafts } from "../api/client.js";
import { AIRCRAFT_STATUS_LABELS } from "../api/types.js";

export const CheckExpiryInputSchema = z.object({
  daysAhead: z
    .number()
    .int()
    .min(0)
    .max(3650)
    .optional()
    .describe("何日先までを期限切れ対象とするか (default: 30)"),
  includeExpired: z
    .boolean()
    .optional()
    .describe("既に期限切れの機体も含めるか (default: true)"),
});

export type CheckExpiryInput = z.infer<typeof CheckExpiryInputSchema>;

export async function checkExpiryTool(config: DipsConfig, input: CheckExpiryInput): Promise<string> {
  const daysAhead = input.daysAhead ?? 30;
  const includeExpired = input.includeExpired ?? true;
  const records = await fetchAircrafts(config);

  const now = Date.now();
  const cutoff = now + daysAhead * 24 * 3600 * 1000;

  const matched = records
    .map((r) => {
      const expTo = Date.parse(r.aircraft_information.effectiveness_period_to);
      const daysUntil = Number.isNaN(expTo) ? null : Math.floor((expTo - now) / (24 * 3600 * 1000));
      return { record: r, expTo, daysUntil };
    })
    .filter(({ expTo, daysUntil }) => {
      if (Number.isNaN(expTo) || daysUntil === null) return false;
      if (!includeExpired && daysUntil < 0) return false;
      return expTo <= cutoff;
    })
    .sort((a, b) => (a.expTo === b.expTo ? 0 : a.expTo < b.expTo ? -1 : 1));

  if (matched.length === 0) {
    return `${daysAhead}日以内に期限切れになる機体はありません。`;
  }

  const lines: string[] = [];
  lines.push(`${daysAhead}日以内に期限切れ${includeExpired ? "（または既に切れている）" : ""}: ${matched.length}件`);
  lines.push("");
  for (const { record, daysUntil } of matched) {
    const a = record.aircraft_information;
    const status = AIRCRAFT_STATUS_LABELS[a.aircraft_status] ?? a.aircraft_status;
    const expiryNote =
      daysUntil! < 0
        ? `${Math.abs(daysUntil!)}日前に失効`
        : daysUntil === 0
        ? "本日失効"
        : `あと${daysUntil}日`;
    lines.push(`- ${a.registration_code} (${a.manufacturer_jpn} ${a.model_jpn}): ${expiryNote} [${a.effectiveness_period_to.slice(0, 10)}] ${status}`);
  }
  return lines.join("\n");
}
