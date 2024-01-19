import { defineStore } from 'pinia'
import type { Song, Database, ConfigValue } from '../types'

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
      mashupSpot: null,
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
      conference: "#vuejsamsterdam",
      voting: false,
      config: [] as ConfigValue[],
      errorMessage: ""
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

      await this.setVotedState()
    },

    async setVotedState() {
      const client = useSupabaseClient<Database>()
      const user = useSupabaseUser();

      if (!user.value) {
        return false
      }

      const { error, data: userVotes } = await client
        .from('votes')
        .select('userid, songid, mashup_spot')
        .eq('userid', user.value?.id)

      if (error) {
        this.errorMessage = 'Something went wrong. You better Tell Tim...'
      }
      else {
        this.errorMessage = '';
      }

      this.songs.forEach(song => {
        const vote = userVotes && userVotes.find(vote => vote.songid === song.songId)

        if (vote) {
          song.mashupSpot = vote.mashup_spot as number
          song.voted = true
        }
        else {
          song.mashupSpot = null
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

      const { error: alreadyVotedError, data: alreadyVoted } = await client
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
            user_avatar: (user.value?.user_metadata?.avatar_url) ? user.value?.user_metadata?.avatar_url : user.value?.user_metadata.picture,
            songid: songId
          })
      }

      if (alreadyVotedError) {
        this.errorMessage = 'Something went wrong. You better Tell Tim...'
        console.log(alreadyVotedError)
      }
      else {
        this.errorMessage = '';
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
        this.errorMessage = 'Something went wrong. You better Tell Tim...'
        console.log(error)
      }
      else {
        this.errorMessage = '';
      }

      await this.setVotedState();
      await new Promise(resolve => setTimeout(resolve, parseInt(voteTimeout)));

      this.voting = false;
    },

    async mashupVote(songId: string, spot: number) {
      const { voteTimeout } = useRuntimeConfig().public

      this.voting = true;
      const client = useSupabaseClient<Database>()
      const user = useSupabaseUser();

      if (!user.value) {
        return false
      }

      const { data: existingVote, error: existingError } = await client
        .from('votes')
        .select('userid, mashup_spot')
        .eq('userid', user.value?.id)
        .eq('mashup_spot', spot)
        .maybeSingle()

      if (existingError) {
        this.errorMessage = 'Something went wrong. You better Tell Tim...'
        console.log(existingError)
      }
      else {
        this.errorMessage = '';
      }

      if (existingVote) {
        const { error: deletionError } = await client
          .from('votes')
          .delete()
          .eq('userid', user.value?.id)
          .eq('mashup_spot', spot)

        if (deletionError) {
          this.errorMessage = 'Something went wrong. You better Tell Tim...'
          console.log(deletionError)
        }
        else {
          this.errorMessage = '';
        }

        const { error: insertedVoteError } = await client
          .from('votes')
          .insert({
            userid: user.value?.id,
            email: user.value?.email || null,
            user_avatar: (user.value?.user_metadata?.avatar_url) ? user.value?.user_metadata?.avatar_url : user.value?.user_metadata.picture,
            songid: songId,
            mashup_spot: spot
          })

        if (insertedVoteError) {
          this.errorMessage = 'Something went wrong. You better Tell Tim...'
          console.log(insertedVoteError)
        }
        else {
          this.errorMessage = '';
        }
      }
      else {
        const { error: insertedVoteError } = await client
          .from('votes')
          .insert({
            userid: user.value?.id,
            email: user.value?.email || null,
            user_avatar: (user.value?.user_metadata?.avatar_url) ? user.value?.user_metadata?.avatar_url : user.value?.user_metadata.picture,
            songid: songId,
            mashup_spot: spot
          })

        if (insertedVoteError) {
          this.errorMessage = 'Something went wrong. You better Tell Tim...'
          console.log(insertedVoteError)
        }
        else {
          this.errorMessage = '';
        }
      }

      await this.setVotedState();
      await new Promise(resolve => setTimeout(resolve, parseInt(voteTimeout)));
      this.voting = false;
    },

    async mashupDownVote(spot: number) {
      const { voteTimeout } = useRuntimeConfig().public

      this.voting = true;
      const client = useSupabaseClient<Database>()
      const user = useSupabaseUser();

      if (!user.value) {
        return false
      }

      const { error: deletionError } = await client
        .from('votes')
        .delete()
        .eq('userid', user.value?.id)
        .eq('mashup_spot', spot)

      if (deletionError) {
        this.errorMessage = 'Something went wrong. You better Tell Tim...'
        console.log(deletionError)
      }
      else {
        this.errorMessage = '';
      }

      await this.setVotedState();
      await new Promise(resolve => setTimeout(resolve, parseInt(voteTimeout)));
      this.voting = false;
    },

    async setConfigValue(key: string, val: string) {
      const client = useSupabaseClient<Database>()

      const { error: setConfigValueError } = await client
        .from('config')
        .update({
          key,
          val
        })
        .eq('key', key)

      if (setConfigValueError) {
        this.errorMessage = 'Something went wrong. You better Tell Tim...'
        console.log(setConfigValueError)
      }
      else {
        this.errorMessage = '';
      }

      const { data, error: setConfigToStateError } = await client
        .from('config')
        .select('key, val')

      if (setConfigToStateError) {
        this.errorMessage = 'Something went wrong. You better Tell Tim...'
        console.log(setConfigToStateError)
      }
      else {
        this.errorMessage = '';
      }

      if (data) {
        this.config = data;
      }
    },

    async getConfigValues() {
      const client = useSupabaseClient<Database>()

      const { data, error } = await client
        .from('config')
        .select('key, val')

      if (error) {
        this.errorMessage = 'Something went wrong. You better Tell Tim...'
        console.log(error)
      }
      else {
        this.errorMessage = '';
      }

      if (data) {
        this.config = data;
      }
    }
  },
  getters: {
    allSongs: state => state.songs,
    errors: state => state.errorMessage,
    configValues: state => state.config,
    getConfigValue: (state) => {
      return (key: string) => state.config.find((conf) => conf.key === key)
    },
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