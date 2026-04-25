import { z } from "zod";
import type { DipsConfig } from "../config.js";
import { fetchAircrafts } from "../api/client.js";

export const GetAircraftDetailInputSchema = z
  .object({
    serial: z.string().optional().describe("製造番号で検索（完全一致）"),
    registrationCode: z.string().optional().describe("登録記号で検索（12桁完全一致）"),
  })
  .refine((v) => !!v.serial || !!v.registrationCode, {
    message: "serial または registrationCode のいずれかが必須",
  });

export type GetAircraftDetailInput = z.infer<typeof GetAircraftDetailInputSchema>;

export async function getAircraftDetailTool(
  config: DipsConfig,
  input: GetAircraftDetailInput
): Promise<string> {
  const all = await fetchAircrafts(config);
  const found = all.find((r) => {
    if (input.registrationCode && r.aircraft_information.registration_code !== input.registrationCode) {
      return false;
    }
    if (input.serial && r.aircraft_information.manufacturing_number !== input.serial) {
      return false;
    }
    return !!input.registrationCode || !!input.serial;
  });

  if (!found) {
    return `該当する機体が見つかりませんでした。検索条件: ${JSON.stringify(input)}`;
  }
  return JSON.stringify(found, null, 2);
}
