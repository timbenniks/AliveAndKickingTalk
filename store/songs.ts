import { defineStore } from 'pinia'
import songs from '../assets/songs.json'

async function checkVoted(songId: string) {
  const client = useSupabaseClient()
  const user = useSupabaseUser();

  let voted = false;

  const { data } = await client
    .from('votes')
    .select('userid, songid')
    .eq('songid', songId)
    .eq('userid', user.value.id)
    .single()

  if (data) {
    voted = true
  }

  return voted
}

async function getVotesForSongId(songId: string) {
  const client = useSupabaseClient()

  const { count } = await client
    .from('votes')
    .select('songid', { count: 'exact', head: true })
    .eq('songid', songId)

  return count
}

export const useSongStore = defineStore({
  id: 'song-store',
  state: () => {
    return {
      voteMax: 4,
      songs,
      songsAndVotes: songs.map(song => {
        return { ...song, votes: 0 }
      })
    }
  },
  actions: {
    async getVotesForSongs() {
      const songsAndVotes = await Promise.all(this.songsAndVotes.map(async (song) => {
        song.votes = await getVotesForSongId(song.songId)
        return song;
      }));

      this.songsAndVotes = songsAndVotes;
    },

    async checkAllSongsVoted() {
      const songs = await Promise.all(this.songs.map(async (song) => {
        song.voted = await checkVoted(song.songId)
        return song;
      }));

      this.songs = songs;
    },

    async upvote(songId: string) {
      const client = useSupabaseClient()
      const user = useSupabaseUser();

      const { data } = await client
        .from('votes')
        .select('userid, songid')
        .eq('songid', songId)
        .eq('userid', user.value.id)
        .single()

      if (data) {
        console.log('already voted')
        return false;
      }

      const { error } = await client
        .from('votes')
        .insert({
          userid: user?.value.id,
          user_avatar: user?.value.user_metadata.avatar_url,
          songid: songId
        })

      if (error) {
        console.warn(error)
      }

      await this.checkAllSongsVoted();
    },
    async downvote(songId: string) {
      const client = useSupabaseClient()
      const user = useSupabaseUser();

      const { error } = await client
        .from('votes')
        .delete()
        .eq('userid', user?.value.id)
        .eq('songid', songId)

      if (error) {
        console.warn(error)
      }

      await this.checkAllSongsVoted();
    }
  },
  getters: {
    allSongs: state => state.songs,
    allSongsAndVotes: state => state.songsAndVotes,
    votedAmount: state => state.songs.filter(song => song.voted).length,
    maxVotes: state => state.voteMax
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSongStore, import.meta.hot));
}