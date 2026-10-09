export const songsQuery = `query Songs {
  all_song(limit: 50) {
    total
    items {
      songid song artist length mp3 cover logo biography formed home_town
      presets { name at pc }
      artwork { imageConnection(limit: 20) { edges { node { url } } } }
    }
  }
}`;

type CloudinaryImage = { secure_url: string; public_id: string; version: number };
type ContentstackSong = {
  songid: string; song: string; artist: string; length: string; mp3: string;
  cover: CloudinaryImage[]; logo?: CloudinaryImage[];
  biography?: string; formed?: string; home_town?: string;
  presets?: { name: string; at: number; pc: number }[];
  artwork?: { imageConnection?: { edges?: { node?: { url?: string } }[] } };
};

export function normalizeSong(entry: ContentstackSong) {
  const cover = entry.cover?.[0];
  if (!entry.songid || !entry.song || !entry.artist || !entry.mp3 || !cover?.secure_url || !cover.public_id) {
    throw new Error('Song is missing required content');
  }
  const imageUrl = (image: CloudinaryImage) => image.secure_url.replace(`v${image.version}/`, 'q_auto,f_auto/');
  const artwork = entry.artwork?.imageConnection?.edges
    ?.map(edge => edge.node?.url).filter((url): url is string => !!url) || [];

  return {
    songId: entry.songid, song: entry.song, artist: entry.artist,
    length: entry.length, mp3: entry.mp3,
    cover: imageUrl(cover), coverPublicId: cover.public_id,
    logo: entry.logo?.[0] ? imageUrl(entry.logo[0]) : '',
    biography: entry.biography || '', formed: entry.formed || '', homeTown: entry.home_town || '',
    presets: entry.presets || [],
    artwork: (artwork.length ? artwork : [imageUrl(cover)]).map(bg => ({
      bg, x: '50%', y: '50%', opacity: '30',
      // Contentstack artwork has no Cloudinary ID. Share composites use the cover.
      publicId: cover.public_id,
    })),
    votes: 0, mashupSpot: null, voted: false,
  };
}
