import { createVoteQueue, performVote } from '#shared/utils/performance'
import { defineStore } from 'pinia'
import type { Song, Database, ConfigValue, PlayedSong, LatestVote } from '../types'
import { log } from '../helpers'

let voteQueue: ReturnType<typeof createVoteQueue> | null = null

const SHARE_ERROR = 'Your share link could not be made. Check your connection and try again.'

function providerAvatar(user: ReturnType<typeof useSupabaseUser>['value']) {
  return String(user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '')
}

async function getSongs() {
  return await $fetch<Song[]>('/api/songs')
}

export const useSongStore = defineStore('song-store', {
  state: () => {
    const { maxVotes } = useRuntimeConfig().public

    return {
      voteMax: parseInt(maxVotes),
      songs: [] as Song[],
      playedSongs: [] as PlayedSong[],
      voting: false,
      savingVotes: false,
      config: [] as ConfigValue[],
      errorMessage: "",
      latestVote: [] as LatestVote[],
      // The voter's avatar copied to our own storage (see /api/avatar). Empty
      // until it is ready, in which case the provider URL is used instead.
      stableAvatar: ""
    }
  },
  actions: {
    async getSongs() {
      log('[async][action] getSongs')

      this.songs = await getSongs();
    },

    async getVotesForSongs() {
      log('[async][action] getVotesForSongs')

      const client = useSupabaseClient<Database>()

      const { data: votesPerSong, error: errorVotesPerSong } = await client
        .from('votes_per_song')
        .select("*")

      if (errorVotesPerSong) {
        this.errorMessage = 'Error [async][action] setVotedState: errorVotesPerSong'
        throw createError('[async][action] setVotedState: errorVotesPerSong')
      }

      this.songs.map(song => {
        const votes = votesPerSong?.find(songVotes => songVotes.songid === song.songId)?.votes
        song.votes = votes || 0
      })
    },

    async getPlayedSongs() {
      log('[async][action] getPlayedSongs')

      const client = useSupabaseClient<Database>()

      const { error: getPlayedSongsError, data } = await client
        .from('songs_played')
        .select('songid, mashup_spot')

      if (getPlayedSongsError) {
        this.errorMessage = 'Error [async][action] getPlayedSongs: getPlayedSongsError'
        throw createError('[async][action] getPlayedSongs: getPlayedSongsError')
      }

      if (data) {
        this.playedSongs = data.map(song => {
          return {
            songId: song.songid,
            mashupSpot: song.mashup_spot
          }
        }) as PlayedSong[]

        log('[async][action] getPlayedSongs', this.playedSongs)
      }
    },

    async setPlayedSong(songId: string, mashup_spot: number) {
      const client = useSupabaseClient<Database>()

      const { error: setPlayedSongError } = await client
        .from('songs_played')
        .upsert({ songid: songId, mashup_spot }, { onConflict: 'songid' })
        .eq('songid', songId);

      if (setPlayedSongError) {
        this.errorMessage = 'Error [async][action] setPlayedSong: setPlayedSongError'
        throw createError('[async][action] setPlayedSong: setPlayedSongError')
      }

      await this.getPlayedSongs()
    },

    async setVotedState() {
      log('[async][action] setVotedState')

      const client = useSupabaseClient<Database>()
      const user = useSupabaseUser();

      if (!user.value) {
        return false
      }

      const { error: votesForUserError, data: userVotes } = await client
        .from('votes')
        .select('userid, songid, mashup_spot')
        .eq('userid', user.value?.sub)

      if (votesForUserError) {
        this.errorMessage = 'Error [async][action] setVotedState: votesForUserError'
        throw createError('[async][action] setVotedState: votesForUserError')
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

    // Instant vote toggle for the song list: flips on screen now, saves in the
    // background through a queue, then resyncs once from the database.
    toggleVote(songId: string) {
      const song = this.songs.find(item => item.songId === songId);
      if (!song) return false;
      const on = !song.voted;
      if (on && this.songs.filter(item => item.voted).length >= this.voteMax) return false;
      song.voted = on;
      voteQueue ??= createVoteQueue({
        write: (id, vote) => this.writeVote(id, vote),
        resync: () => this.setVotedState(),
        onError: () => { this.errorMessage = 'Your vote could not be saved. Check your connection and try again.'; },
        onBusy: (busy) => { this.savingVotes = busy; },
      });
      void voteQueue.push(songId, on);
      return true;
    },

    // One vote write, no waiting or resync. The queue calls this.
    async writeVote(songId: string, on: boolean) {
      const client = useSupabaseClient<Database>();
      const user = useSupabaseUser();
      if (!user.value) throw new Error("Sign in to vote");
      if (!on) {
        const { error } = await client.from('votes').delete().eq('userid', user.value.sub).eq('songid', songId);
        if (error) throw error;
        return;
      }
      // There is no unique constraint on votes yet, so check before inserting.
      const { error: lookupError, data: existing } = await client
        .from('votes').select('songid').eq('songid', songId).eq('userid', user.value.sub).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) return;
      const { error } = await client.from('votes').insert({
        userid: user.value.sub,
        email: user.value.email || null,
        user_avatar: this.stableAvatar || providerAvatar(user.value),
        songid: songId,
      });
      if (error) throw error;
    },

    async mashupVote(songId: string, spot: number) {
      return performVote(this, async () => {
        log('[async][action] mashupVote', songId, spot)

        const client = useSupabaseClient<Database>()
        const user = useSupabaseUser();

        if (!user.value) {
          this.errorMessage = 'Error [async][action] mashupVote: no user'
          throw createError('[async][action] mashupVote: no user')
        }

        const avatar = this.stableAvatar || providerAvatar(user.value)

        // One transaction in the database: the spot (and this song in any other
        // spot) is replaced, or nothing changes.
        const { error: rpcError } = await client.rpc('mashup_vote', { p_songid: songId, p_spot: spot, p_avatar: avatar })

        // PGRST202: the function does not exist yet (migration not applied).
        if (rpcError?.code === 'PGRST202') {
          const { error: deletionError } = await client
            .from('votes')
            .delete()
            .eq('userid', user.value.sub)
            .eq('mashup_spot', spot)
          if (deletionError) throw deletionError

          const { error: insertedVoteError } = await client
            .from('votes')
            .insert({
              userid: user.value.sub,
              email: user.value.email || null,
              user_avatar: avatar,
              songid: songId,
              mashup_spot: spot
            })
          if (insertedVoteError) throw insertedVoteError
        }
        else if (rpcError) {
          throw rpcError
        }

        await this.setVotedState();

      });
    },

    async mashupDownVote(spot: number) {
      return performVote(this, async () => {
        log('[async][action] mashupDownVote', spot)



        const client = useSupabaseClient<Database>()
        const user = useSupabaseUser();

        if (!user.value) {

          this.errorMessage = 'Error [async][action] mashupDownVote: no user'

          throw createError('[async][action] mashupDownVote: no user')
        }

        const { error: deletionError } = await client
          .from('votes')
          .delete()
          .eq('userid', user.value?.sub)
          .eq('mashup_spot', spot)

        if (deletionError) {
          this.errorMessage = 'Error [async][action] mashupDownVote: deletionError'
          throw createError('[async][action] mashupDownVote: deletionError')
        }

        await this.setVotedState();

      });
    },

    async setConfigValue(key: string, val: string | boolean) {
      log('[async][action] setConfigValue', key, val)

      const client = useSupabaseClient<Database>()

      const { error: setConfigValueError } = await client
        .from('config')
        .update({
          key,
          val: String(val)
        })
        .eq('key', key)

      if (setConfigValueError) {
        this.errorMessage = 'Error [async][action] setConfigValue: setConfigValueError'
        throw createError('[async][action] setConfigValue: setConfigValueError')
      }

      const { data, error: setConfigToStateError } = await client
        .from('config')
        .select('key, val')

      if (setConfigToStateError) {
        this.errorMessage = 'Error [async][action] setConfigValue: setConfigToStateError'
        throw createError('[async][action] setConfigValue: setConfigToStateError')
      }

      if (data) {
        this.config = data as ConfigValue[];
      }
    },

    async getConfigValues() {
      log('[async][action] getConfigValues')

      const client = useSupabaseClient<Database>()

      const { data, error: selectConfigValuesError } = await client
        .from('config')
        .select('key, val')

      if (selectConfigValuesError) {
        this.errorMessage = 'Error [async][action] getConfigValues: selectConfigValuesError'
        throw createError('[async][action] getConfigValues: selectConfigValuesError')
      }

      if (data) {
        this.config = data as ConfigValue[];
        log('[async][action] getConfigValues', data)

      }
    },

    // Returns the new share's id, or null (with errorMessage set) when the share
    // could not be saved, so a link is never built without an id.
    async saveShare(userid: string, avatar: string, mashup: boolean, songId?: string): Promise<number | null> {
      const client = useSupabaseClient<Database>()
      let songids = songId || ''

      if (mashup) {
        const { data: votes, error: votesError } = await client
          .from('votes')
          .select('songid')
          .eq('userid', userid)
          .order('mashup_spot');

        if (votesError) {
          this.errorMessage = SHARE_ERROR
          return null
        }
        songids = (votes || []).map(vote => vote.songid).join(',')
      }

      if (!userid || !songids) {
        this.errorMessage = SHARE_ERROR
        return null
      }

      const { data, error } = await client
        .from('shares')
        .insert({ userid, user_avatar: this.stableAvatar || avatar, mashup, songids })
        .select('id')
        .single()

      if (error || !data?.id) {
        this.errorMessage = SHARE_ERROR
        return null
      }
      return data.id
    }
  },
  getters: {
    allSongs: state => state.songs,
    allPlayedSongs: state => state.playedSongs,
    getPlayedSong: (state) => {
      return (songId: string) => state.playedSongs.find((song) => song.songId === songId)
    },
    theLatestVotes: state => state.latestVote,
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
