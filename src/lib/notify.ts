import { supabase } from "@/integrations/supabase/client";

export async function notify(params: {
  userId: string;
  actorId?: string | null;
  type: string;
  message?: string;
  entityType?: string;
  entityId?: string;
}) {
  if (params.userId === params.actorId) return; // don't notify self
  await supabase.from("notifications").insert({
    user_id: params.userId,
    actor_id: params.actorId ?? null,
    type: params.type,
    message: params.message ?? null,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
  });
}
