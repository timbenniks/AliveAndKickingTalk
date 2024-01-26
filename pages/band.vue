<script setup lang="ts">
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Database } from "../types";

const client = useSupabaseClient<Database>();
let realtimeChannel: RealtimeChannel;

const { data: song, refresh: refreshSong } = await useAsyncData(
  "song_band",
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
      artist: song.artist,
      logo:
        song?.logo.secure_url.replace(
          `v${song.logo.version}`,
          "q_auto,f_auto"
        ) || "",
      biography: song?.biography || "",
      homeTown: song?.homeTown || "",
      formed: song?.formed || "",
      artwork: song.artwork.map((art) => {
        return {
          bg: art.bg.secure_url.replace(
            `v${art.bg.version}`,
            art.cloudinaryTransform?.replace(",o_30", "")
          ),
          x: art.x,
          y: art.y,
          opacity: art.opacity,
        };
      }),
    };
  }
);

onMounted(async () => {
  realtimeChannel = client
    .channel("public:config")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "config" },
      () => refreshSong()
    );

  realtimeChannel.subscribe();
});

onUnmounted(() => {
  client.removeChannel(realtimeChannel);
});

const imgBase =
  "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_70/Alive%20and%20Kicking/bg";
const bgs = {
  artwork: [
    { bg: `${imgBase}/1.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/2.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/3.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/4.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/5.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/6.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/7.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/8.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/9.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/10.png`, x: "0%", y: "0%" },
  ],
};
</script>
<template>
  <main class="relative w-screen h-screen top-0 left-0">
    <template v-if="song">
      <backgrond-slider :song="song" class="z-0" :timeout="10000" />
      <img
        src="/logo.png"
        alt="Alive & Kicking"
        class="absolute bottom-4 right-4 w-96 z-20"
      />
      <article
        class="bg-black bg-opacity-80 absolute z-20 bottom-4 left-4 w-[600px] p-4"
      >
        <h1 class="text-7xl font-black mb-2 flowing-title inline-block">
          {{ song.artist }}
        </h1>
        <p class="font-black uppercase mb-4">
          {{ song.formed }}, {{ song.homeTown }}
        </p>
        <p class="mb-4 text-xl leading-7">{{ song.biography }}</p>

        <img :src="song.logo" :alt="song.artist" class="fancy-image w-full" />
      </article>
    </template>
    <template v-else>
      <backgrond-slider :song="bgs" class="z-0" :timeout="10000" />

      <div
        class="absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 z-20 flex flex-col items-center"
      >
        <img src="/logo.png" alt="Alive & Kicking" class="w-[600px]" />
        <img src="/vueamsterdam.png" alt="Vuejs Amsterdam" class="w-[300px]" />
      </div>
    </template>
  </main>
</template>
