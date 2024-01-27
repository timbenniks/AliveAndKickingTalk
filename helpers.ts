import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createRealtimeChannel(callback: Function, table: "votes" | "config" | "played_songs", event: "UPDATE" | "INSERT") {
  console.info('[LIVE]: setting up real time channel')
  const client = useSupabaseClient<Database>();
  const realtimeChannel: RealtimeChannel = client
    .channel(`public:${table}`)
    .on(
      // @ts-ignore
      "postgres_changes",
      { event, schema: "public", table },
      () => callback()
    )

  return realtimeChannel;
}

export function removeRealtimeChannel(realtimeChannel: RealtimeChannel) {
  console.info('[LIVE]: removing real time channel')
  const client = useSupabaseClient<Database>();
  client.removeChannel(realtimeChannel);
}