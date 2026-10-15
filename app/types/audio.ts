export type AudioPlayerEvent = {
  event: Event;
  setPlaying: (value: boolean) => void;
  setMuted: (value: boolean) => void;
  setVolume: (value: number) => void;
};
