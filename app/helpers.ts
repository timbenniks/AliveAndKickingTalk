import type { RealtimeChannel } from "@supabase/supabase-js";
import { buildSetlist } from '#shared/utils/performance';
import type { Database, PlayedSong, Song, realtimeOptions } from "./types";

export function log(...args: unknown[]) {
  const debugMode = process.env.NODE_ENV === 'development'
  if (debugMode) console.log(...args)
}

export function createRealtimeChannel(channel: string, options: realtimeOptions[]) {
  log(`[LIVE]: setting up real time channel for ${channel}`)
  const client = useSupabaseClient<Database>();

  const realtimeChannel: RealtimeChannel = client.channel(channel)

  options.forEach(option => {
    realtimeChannel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: option.table },
      payload => { if (option.event === "*" || payload.eventType === option.event) void option.callback(payload); }
    )
  });

  return realtimeChannel;
}

export function removeRealtimeChannel(realtimeChannel: RealtimeChannel) {
  log('[LIVE]: removing real time channel')
  const client = useSupabaseClient<Database>();
  client.removeChannel(realtimeChannel);
}

export function mergePlayedSongsWithAllSongs(allSongs: ComputedRef<Song[]>, allPlayedSongs: ComputedRef<PlayedSong[]>) {
  return buildSetlist(allSongs.value, allPlayedSongs.value);
}
