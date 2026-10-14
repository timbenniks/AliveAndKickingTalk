import { constructCloudinaryUrl } from "@cloudinary-util/url-loader";
import type { Song } from "../types/song.ts";

export async function createMashupImage(avatar: string, allSongs: Song[], songids: string) {
  const songIdsArray = songids.split(',');
  const filteredSongs = songIdsArray.map(id => allSongs.find(song => song.songId === id)).filter((song): song is Song => !!song);

  const songs = filteredSongs?.map((song) => {
    return {
      art: song?.artwork[0]?.publicId,
      cover: song?.coverPublicId,
      artist: song?.artist.replace("/", "%2F"),
      song: song?.song,
    };
  });

  if (songs.length !== 4) throw new Error('A mashup image needs four songs');
  const [first, second, third, fourth] = songs as [typeof songs[number], typeof songs[number], typeof songs[number], typeof songs[number]];

  const cldOptions: Parameters<typeof constructCloudinaryUrl>[0]['options'] = {
    src: "Alive and Kicking/bg.jpg",
    width: 1920,
    height: 1080,
    crop: "fill",
    format: "jpg",

    overlays: [
      // Art
      {
        publicId: first.art,
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
        publicId: second.art,
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
        publicId: third.art,
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
        publicId: fourth.art,
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
        publicId: first.cover,
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
        publicId: second.cover,
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
        publicId: third.cover,
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
        publicId: fourth.cover,
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
        publicId: "Alive and Kicking/contentcon24-overlay-mashup",
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
    options: cldOptions,
    config: {
      cloud: {
        cloudName: "dwfcofnrd",
      },
    },
    // The SDK's analytics tag differs between server and browser, which broke
    // hydration on the share page. Off keeps the URL identical everywhere.
    analytics: false,
  });

  return url
}

export async function createShareImage(avatar: string, song: Song) {
  const art = song?.artwork[0]?.publicId;
  const artist = song?.artist.replace("/", "%2F");
  const songTitle = song?.song;

  const cldOptions: Parameters<typeof constructCloudinaryUrl>[0]['options'] = {
    src: art || "",
    width: 1920,
    height: 1080,
    crop: "fill",
    format: "jpg",
    rawTransformations: ["b_black,o_20"],

    overlays: [
      {
        publicId: `Alive and Kicking/contentcon24-overlay-2.png`,
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
        url: avatar.replace("_normal", ""),
        position: {
          y: -250,
          gravity: "center",
        },
        effects: [
          {
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
    options: cldOptions,
    config: {
      cloud: {
        cloudName: "dwfcofnrd",
      },
    },
    // The SDK's analytics tag differs between server and browser, which broke
    // hydration on the share page. Off keeps the URL identical everywhere.
    analytics: false,
  });

  return url
}
// "My picks" share image: the four-cover layout once there are four or more
// picks (first four in setlist order), else the single-song image of the first.
export async function createPicksImage(avatar: string, allSongs: Song[], songIds: string[]) {
  const picks = allSongs.filter(song => songIds.includes(song.songId));
  if (!picks.length) throw new Error('A picks image needs at least one song');
  if (picks.length >= 4) return createMashupImage(avatar, allSongs, picks.slice(0, 4).map(song => song.songId).join(','));
  return createShareImage(avatar, picks[0]!);
}
