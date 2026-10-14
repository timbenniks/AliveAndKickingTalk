// Where the stage set stands, shared by everything built on or around it.

export const DECK_TOP = 8.2
export const DECK_FRONT = 22

// Lighting truss and the par cans hanging under it.
export const TRUSS_Y = 23.6
export const TRUSS_Z = DECK_FRONT + 4
export const TRUSS_SPAN = 15.5
export const CANS = [-11, -7.5, -4, -1.2, 1.2, 4, 7.5, 11] as const

// The LED wall: close behind the truss, high enough to clear the amp boards.
export const LED_COLS = 128
export const LED_ROWS = 72
export const LED_WIDTH = 22.5
export const LED_HEIGHT = LED_WIDTH * LED_ROWS / LED_COLS
export const LED_CENTER = { y: 10.2 + LED_HEIGHT / 2, z: 28 } as const
