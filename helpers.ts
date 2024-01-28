import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Database, PlayedSong, Song, realtimeOptions } from "./types";

export function log(...args: any[]) {
  const debugMode = process.env.NODE_ENV === 'development'
  debugMode && console.log(...args)
}

export function createRealtimeChannel(channel: string, options: realtimeOptions[]) {
  const { debugMode } = useRuntimeConfig().public

  log(`[LIVE]: setting up real time channel for ${channel}`)
  const client = useSupabaseClient<Database>();

  const realtimeChannel: RealtimeChannel = client.channel(channel)

  options.forEach(option => {
    realtimeChannel.on(
      // @ts-ignore
      "postgres_changes",
      { event: option.event, schema: "public", table: option.table },
      () => option.callback()
    )
  });

  return realtimeChannel;
}

export function removeRealtimeChannel(realtimeChannel: RealtimeChannel) {
  const { debugMode } = useRuntimeConfig().public

  log('[LIVE]: removing real time channel')
  const client = useSupabaseClient<Database>();
  client.removeChannel(realtimeChannel);
}

export function mergePlayedSongsWithAllSongs(allSongs: ComputedRef<Song[]>, allPlayedSongs: ComputedRef<PlayedSong[]>) {
  const songsOrdered = allSongs.value.sort((a, b) => b.votes - a.votes);
  const playedSongsEnriched = allPlayedSongs.value.map((song) => {
    return {
      ...allSongs.value.find(
        (allSongsSong) => allSongsSong.songId === song.songId
      ),
      mashupSpot: song.mashupSpot,
      blocked: true,
    };
  });

  const remainingSongs = [...songsOrdered];

  for (let song of playedSongsEnriched) {
    const index = remainingSongs.findIndex((s) => s.songId === song.songId);
    if (index !== -1) {
      remainingSongs.splice(index, 1);
    }
  }

  const resultSongs: Song[] = [];

  for (let i = 1; i <= 4; i++) {
    const playedSong = playedSongsEnriched.find(
      (song) => song.mashupSpot === i
    );

    if (playedSong) {
      resultSongs.push(playedSong as Song);
    } else {
      const songToAdd = remainingSongs.shift();

      if (songToAdd) {
        resultSongs.push(songToAdd);
      }
    }
  }

  return resultSongs;
}