export type ConfigValue = {
  key: string
  val: string
}

export type PlayedSong = {
  songId: string,
  mashupSpot: number
}

export type realtimeOptions = {
  callback: (payload: { eventType: string; new: Record<string, unknown> }) => void | Promise<void>
  table: "votes" | "config" | "songs_played" | "votes_per_song"
  event: "UPDATE" | "INSERT" | "DELETE" | "*"
}

export type LatestVote = {
  userid: string;
  user_avatar: string;
  songid: string;
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
  presets: Array<{
    name: string
    at: number
    pc: number
  }>
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

export type eventReturn = {
  event: Event;
  setPlaying: (value: boolean) => void;
  setMuted: (value: boolean) => void;
  setVolume: (value: number) => void;
};

export type Vote = {
  userid: string;
  user_avatar: string;
  songid: string;
};

export type events =
  | "play"
  | "pause"
  | "ended"
  | "loadeddata"
  | "waiting"
  | "playing"
  | "timeupdate"
  | "canplay"
  | "canplaythrough"
  | "statechanged"
  | "volumechange";
