import { defineStore } from 'pinia'

async function checkVoted(songId: string) {
  const client = useSupabaseClient()
  const user = useSupabaseUser();

  let voted = false;

  const { data } = await client
    .from('votes')
    .select('userid, songid')
    .eq('songid', songId)
    .eq('userid', user.value?.id)
    .maybeSingle()

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

async function getVotes() {
  const client = useSupabaseClient()

  const { data } = await client
    .from('votes')
    .select('created_at, userid, songid, email, user_avatar')

  return data
}

async function getSongs() {
  const { songs } = await GqlSongs();
  return songs.map(song => {
    return {
      songId: song.songId,
      song: song.song,
      artist: song.artist,
      cover: song.cover.secure_url.replace(`v${song.cover.version}`, 'q_auto,f_auto'),
      length: song.length,
      mp3: song.mp3,
      presets: song.presets,
      artwork: song.artwork.map(art => {
        return {
          bg: art.bg.secure_url.replace(`v${art.bg.version}`, art.cloudinaryTransform),
          bgX: art.x,
          bgY: art.y,
          opacity: art.opacity
        }
      }),
      votes: 0
    }
  })
}

export const useSongStore = defineStore({
  id: 'song-store',
  state: () => {
    return {
      voteMax: 3,
      songs: [],
      songsAndVotes: [],
      votes: [],
      conference: "Vue.js Amsterdam 2024",
      voting: false
    }
  },
  actions: {

    async getSongs() {
      this.songs = await getSongs();
      this.songsAndVotes = await getSongs();
    },

    async getVotesForSongs() {
      const songsAndVotes = await Promise.all(this.songsAndVotes.map(async (song) => {
        song.votes = await getVotesForSongId(song.songId)
        return song;
      }));

      this.songsAndVotes = songsAndVotes;
    },

    async getVotes() {
      const votes = await getVotes()
      this.votes = votes;
    },

    async checkAllSongsVoted() {
      const songs = await Promise.all(this.songs.map(async (song) => {
        song.voted = await checkVoted(song.songId)
        return song;
      }));

      this.songs = songs;
    },

    async upvote(songId: string) {
      this.voting = true;
      const client = useSupabaseClient()
      const user = useSupabaseUser();

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
            // @ts-ignore
            userid: user.value?.id,
            email: user.value?.email || "",
            user_avatar: user.value?.user_metadata.avatar_url,
            songid: songId
          })
      }

      await this.checkAllSongsVoted();
      await new Promise(resolve => setTimeout(resolve, 500));
      this.voting = false;
    },
    async downvote(songId: string) {
      this.voting = true;
      const client = useSupabaseClient()
      const user = useSupabaseUser();

      const { error } = await client
        .from('votes')
        .delete()
        .eq('userid', user.value?.id)
        .eq('songid', songId)

      if (error) {
        console.warn(error)
      }

      await this.checkAllSongsVoted();
      await new Promise(resolve => setTimeout(resolve, 500));

      this.voting = false;
    }
  },
  getters: {
    allSongs: state => state.songs,
    allSongsAndVotes: state => state.songsAndVotes,
    votedAmount: state => state.songs.filter(song => song.voted).length,
    maxVotes: state => state.voteMax,
    allVotes: state => state.votes,
    getSongById: (state) => {
      return (songId: string) => state.songs.find((song) => song.songId === songId)
    }
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSongStore, import.meta.hot));
}