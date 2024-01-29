import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Database, PlayedSong, Song, realtimeOptions } from "./types";
import { constructCloudinaryUrl } from "@cloudinary-util/url-loader";

export function log(...args: any[]) {
  const debugMode = process.env.NODE_ENV === 'development'
  debugMode && console.log(...args)
}

export function createRealtimeChannel(channel: string, options: realtimeOptions[]) {
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

export async function createMashupImage(userid: string, allSongs: ComputedRef<Song[]>) {
  const client = useSupabaseClient<Database>();

  const { data: votes } = await client
    .from("votes")
    .select("*")
    .eq("userid", userid as string)
    .order("mashup_spot");

  const avatar = (votes && votes[0].user_avatar.replace("_normal", "")) || "";
  const songs = votes?.map((vote) => {
    const song = allSongs.value.find((s) => s.songId === vote.songid);

    return {
      art: song?.artwork[0].publicId,
      cover: song?.coverPublicId,
      artist: song?.artist.replace("/", "%2F"),
      song: song?.song,
    };
  });

  const cldOptions = {
    src: "Alive and Kicking/bg.jpg",
    width: 1920,
    height: 1080,
    crop: "fill",
    format: "jpg",

    overlays: [
      // Art
      {
        publicId: songs && songs[0].art,
        position: {
          gravity: "north_west",
          y: -50,
        },
        effects: [
          {
            opacity: 30,
            width: 960,
            height: 540,
          },
        ],
      },
      {
        publicId: songs && songs[1].art,
        position: {
          gravity: "north_east",
          y: -50,
        },
        effects: [
          {
            opacity: 30,
            width: 960,
            height: 540,
          },
        ],
      },

      {
        publicId: songs && songs[2].art,
        position: {
          gravity: "south_west",
          y: 50,
        },
        effects: [
          {
            opacity: 30,
            width: 960,
            height: 540,
          },
        ],
      },

      {
        publicId: songs && songs[3].art,
        position: {
          gravity: "south_east",
          y: 50,
        },
        effects: [
          {
            opacity: 30,
            width: 960,
            height: 540,
          },
        ],
      },

      // Covers
      {
        publicId: songs && songs[0].cover,
        position: {
          gravity: "north_west",
          x: 340,
          y: 80,
        },
        effects: [
          {
            border: "3px_solid_white",
            width: 300,
            height: 300,
          },
        ],
      },

      {
        publicId: songs && songs[1].cover,
        position: {
          gravity: "north_east",
          x: 340,
          y: 80,
        },
        effects: [
          {
            border: "3px_solid_white",
            width: 300,
            height: 300,
          },
        ],
      },
      {
        publicId: songs && songs[2].cover,
        position: {
          gravity: "south_west",
          x: 340,
          y: 180,
        },
        effects: [
          {
            border: "3px_solid_white",
            width: 300,
            height: 300,
          },
        ],
      },

      {
        publicId: songs && songs[3].cover,
        position: {
          gravity: "south_east",
          x: 340,
          y: 180,
        },
        effects: [
          {
            border: "3px_solid_white",
            width: 300,
            height: 300,
          },
        ],
      },

      // User
      {
        url: avatar,
        position: {
          gravity: "center",
          y: -50,
        },
        effects: [
          {
            width: 300,
            height: 300,
            radius: 600,
          },
        ],
      },

      // Marketing
      {
        publicId: "Alive and Kicking/vuejsams24-overlay-mashup-6",
        position: {
          x: 0,
          y: 0,
        },
        effects: [
          {
            width: 1920,
            height: 1080,
          },
        ],
      },
    ],
  }

  const url = constructCloudinaryUrl({
    // @ts-ignore
    options: cldOptions,
    config: {
      cloud: {
        cloudName: "dwfcofnrd",
      },
    },
  });

  return url
}

export async function createShareImage(userid: string, songid: string, selectedSong: Song) {
  const client = useSupabaseClient<Database>();

  const { data: vote } = await client
    .from("votes")
    .select("*")
    .eq("songid", songid)
    .eq("userid", userid as string)
    .maybeSingle();

  if (!vote) {
    throw createError({
      statusCode: 500,
      statusMessage: `No vote found for song: ${songid} and user: ${userid}`
    })
  }

  const art = selectedSong?.artwork[0].publicId;
  const artist = selectedSong?.artist.replace("/", "%2F");
  const songTitle = selectedSong?.song;

  const cldOptions = {
    src: art || "",
    width: 1920,
    height: 1080,
    crop: "fill",
    format: "jpg",
    rawTransformations: ["b_black,o_20"],

    overlays: [
      {
        publicId: `Alive and Kicking/share-vuejsams-overlay.png`,
        position: {
          x: 0,
          y: 0,
        },
        effects: [
          {
            width: 1920,
            height: 1080,
          },
        ],
      },
      {
        url: vote?.user_avatar.replace("_normal", ""),
        position: {
          y: -250,
          gravity: "center",
        },
        effects: [
          {
            //@ts-ignore
            crop: "fill",
            gravity: "auto",
            width: 250,
            height: 250,
            radius: 1000,
          },
        ],
      },
      {
        width: 1400,
        crop: "fit",
        text: {
          color: "white",
          fontFamily: "Archivo Black",
          fontSize: 70,
          text: artist,
        },
        position: {
          y: 120,
          gravity: "center",
        },
      },
      {
        width: 1400,
        crop: "fit",
        text: {
          color: "white",
          fontFamily: "Archivo Black",
          fontSize: 70,
          text: songTitle,
        },
        position: {
          y: 195,
          gravity: "center",
        },
      },
    ],
  }

  const url = constructCloudinaryUrl({
    // @ts-ignore
    options: cldOptions,
    config: {
      cloud: {
        cloudName: "dwfcofnrd",
      },
    },
  });

  return url
}