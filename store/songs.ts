import { defineStore } from 'pinia'

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

export const useSongStore = defineStore({
  id: 'song-store',
  state: () => {
    return {
      voteMax: 2,
      songs: [
        {
          songId: "eagles_hotel_california",
          artist: "Eagles",
          song: "Hotel California",
          voted: false,
          cover:
            "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto/Alive%20and%20Kicking/eagles-hotel-california-cover.png",
          artwork: [
            {
              bgX: "34%",
              bg: "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_25/Alive%20and%20Kicking/eagles-hotel-california-art1.png",
            },
          ],
        },
        {
          songId: "eagles_hotel_california1",
          artist: "Eagles",
          song: "Hotel California",
          voted: false,
          cover:
            "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto/Alive%20and%20Kicking/eagles-hotel-california-cover.png",
          artwork: [
            {
              bgX: "34%",
              bg: "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_25/Alive%20and%20Kicking/tim1.png",
            },
          ],
        },
        {
          songId: "eagles_hotel_california2",
          artist: "Eagles",
          song: "Hotel California",
          voted: false,
          cover:
            "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto/Alive%20and%20Kicking/eagles-hotel-california-cover.png",
          artwork: [
            {
              bgX: "34%",
              bg: "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_25/Alive%20and%20Kicking/tim2.png",
            },
          ],
        },
      ],
    }
  },
  actions: {
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
        console.error(error)
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
        console.error(error)
      }

      await this.checkAllSongsVoted();
    }
  },
  getters: {
    allSongs: state => state.songs,
    votedAmount: state => state.songs.filter(song => song.voted).length,
    maxVotes: state => state.voteMax
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSongStore, import.meta.hot));
}