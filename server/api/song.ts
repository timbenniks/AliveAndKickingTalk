import { H3Event } from 'h3';
import songs from '../../assets/songs.json'

export default defineEventHandler(async (event: H3Event) => {
  const { id } = getQuery(event)

  const result = songs.find(song => song.songId === id)

  if (!result) {
    return { error: "song not found" }
  }

  return result
})