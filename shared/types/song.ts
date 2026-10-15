export type ConfigValue = {
  key: string
  val: string
}

export type PlayedSong = {
  songId: string,
  mashupSpot: number
}

export type Song = {
  songId: string
  song: string
  artist: string
  cover: string
  coverPublicId: string
  logo: string
  biography: string
  formed: string
  homeTown: string
  length: string
  mp3: string
  presets: AmpPreset[]
  artwork: Array<{
    publicId: string
    bg: string
    cloudinaryTransform?: string
    opacity: string
    x: string
    y: string
  }>
  votes: number
  voted: boolean
  mashupSpot: number | null
  blocked?: boolean
}

export type AmpPreset = {
  pc: number;
  name: string;
  at: number;
};

export type Vote = {
  userid: string;
  user_avatar: string;
  songid: string;
};
