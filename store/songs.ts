import { defineStore } from 'pinia'
import type { Song, Database } from '../types'

async function getSongs() {
  const { songs } = await GqlSongs();
  const mappedSongs = songs.map(song => {
    return {
      songId: song.songId,
      song: song.song,
      artist: song.artist,
      cover: song.cover.secure_url.replace(`v${song.cover.version}`, 'q_auto,f_auto'),
      length: song.length,
      mp3: song.mp3,
      presets: song.presets,
      artwork: song.artwork.map((art) => {
        return {
          bg: art.bg.secure_url.replace(`v${art.bg.version}`, art.cloudinaryTransform),
          x: art.x,
          y: art.y,
          opacity: art.opacity,
          cloudinaryTransform: art.cloudinaryTransform
        }
      }),
      votes: 0,
      voted: false
    } as Song
  })

  return mappedSongs
}

export const useSongStore = defineStore({
  id: 'song-store',
  state: () => {
    const { maxVotes } = useRuntimeConfig().public

    return {
      voteMax: parseInt(maxVotes),
      songs: [] as Song[],
      conference: "Vue.js Amsterdam 2024",
      voting: false
    }
  },
  actions: {
    async getSongs() {
      this.songs = await getSongs();
    },

    async getVotesForSongs() {
      const client = useSupabaseClient<Database>()

      const { data: votesPerSong } = await client
        .from('votes_per_song')
        .select("*")

      this.songs.map(song => {
        const votes = votesPerSong?.find(songVotes => songVotes.songid === song.songId)?.votes
        song.votes = votes || 0
      })
    },

    async setVotedState() {
      const client = useSupabaseClient<Database>()
      const user = useSupabaseUser();

      if (!user.value) {
        return false
      }

      const { data: userVotes } = await client
        .from('votes')
        .select('userid, songid')
        .eq('userid', user.value?.id)

      this.songs.forEach(song => {
        if (userVotes && userVotes.find(vote => vote.songid === song.songId)) {
          song.voted = true
        }
        else {
          song.voted = false
        }
      })
    },

    async upvote(songId: string) {
      const { voteTimeout } = useRuntimeConfig().public

      this.voting = true;
      const client = useSupabaseClient<Database>()
      const user = useSupabaseUser();

      if (!user.value) {
        return false
      }

      const { data: alreadyVoted } = await client
        .from('votes')
        .select('userid, songid')
        .eq('songid', songId)
        .eq('userid', user.value?.id)
        .maybeSingle()

      if (!alreadyVoted) {
        await client
          .from('votes')
          .insert({
            userid: user.value?.id,
            email: user.value?.email || null,
            user_avatar: user.value?.user_metadata.avatar_url,
            songid: songId
          })
      }

      await this.setVotedState();
      await new Promise(resolve => setTimeout(resolve, parseInt(voteTimeout)));
      this.voting = false;
    },

    async downvote(songId: string) {
      const { voteTimeout } = useRuntimeConfig().public
      this.voting = true;
      const client = useSupabaseClient<Database>()
      const user = useSupabaseUser();

      if (!user.value) {
        return false
      }

      const { error } = await client
        .from('votes')
        .delete()
        .eq('userid', user.value?.id)
        .eq('songid', songId)

      if (error) {
        console.warn(error)
      }

      await this.setVotedState();
      await new Promise(resolve => setTimeout(resolve, parseInt(voteTimeout)));

      this.voting = false;
    }
  },
  getters: {
    allSongs: state => state.songs,
    votedAmount: state => state.songs.filter(song => song.voted).length,
    maxVotes: state => state.voteMax,
    getSongById: (state) => {
      return (songId: string) => state.songs.find((song) => song.songId === songId)
    }
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSongStore, import.meta.hot));
}