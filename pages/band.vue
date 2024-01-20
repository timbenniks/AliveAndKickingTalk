<script setup lang="ts">
import type { Database } from "../types";

const client = useSupabaseClient<Database>();
const { data: song, refresh: refreshSong } = await useAsyncData(
  "song",
  async () => {
    const { data } = await client
      .from("config")
      .select("*")
      .eq("key", "active_song")
      .single();

    const { song } = await GqlSong({ song: data.val });

    if (!song) {
      return false;
    }

    return {
      songId: song.songId,
      song: song.song,
      artist: song.artist,
      cover: song.cover.secure_url.replace(
        `v${song.cover.version}`,
        "q_auto,f_auto"
      ),
      length: song.length,
      artwork: song.artwork.map((art) => {
        const bg = art.bg.secure_url.replace(
          `v${art.bg.version}`,
          art.cloudinaryTransform?.replace(",o_30", "")
        );

        return bg;
      }),
    };
  }
);

setInterval(refreshSong, 5000);
</script>
<template>
  <pre>{{ song }}</pre>
</template>
