export type * from '#shared/types/song'
export type * from '#shared/types/database'

export type Ball = {
  image: HTMLImageElement;
  radius: number;
  x: number;
  y: number;
  dy: number;
  dx: number;
  vel: number;
  update: () => void;
};
