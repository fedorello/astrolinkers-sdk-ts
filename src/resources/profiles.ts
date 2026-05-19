/** Profiles resource — talent / hiring profile from a chart. */

import type { Transport } from "../transport.js";
import { type SkillProfile, SkillProfileSchema } from "../types/profiles.js";

export class Profiles {
  constructor(private readonly transport: Transport) {}

  async talent(chartId: string): Promise<SkillProfile> {
    const data = await this.transport.request("GET", `/v1/charts/${chartId}/profile/talent`);
    return SkillProfileSchema.parse(data);
  }
}
