import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CampaignEventInput = {
  playerId: string;
  campaignId: string | null;
  eventType: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
};

/** Returns false when the event was already recorded (duplicate idempotency key). */
export async function recordCampaignEvent(input: CampaignEventInput): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("campaign_events").insert({
    player_id: input.playerId,
    campaign_id: input.campaignId,
    event_type: input.eventType,
    idempotency_key: input.idempotencyKey,
    payload: input.payload ?? {},
  } as never);

  if (error) {
    if (/duplicate|unique/i.test(error.message)) return false;
    throw error;
  }
  return true;
}
