import { storeToRefs } from 'pinia';
import type { Database } from '~/types';
import type { Fan } from '#shared/stage/types';
import { stageClock } from '#shared/stage/clock';

// The mosh pit (live screen only): seeded with everyone who has voted, newest
// first, one fan per voter. New votes drop in and get a short toast.
export function useStageCrowd(live: () => boolean) {
  const songStore = useSongStore();
  const { allSongs, theLatestVotes } = storeToRefs(songStore);
  const crowd = shallowRef<Fan[] | undefined>();
  const toast = shallowRef<{ avatar: string; song: string; key: number } | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  async function seedCrowd() {
    const { data } = await useSupabaseClient<Database>()
      .from('votes').select('userid, songid, user_avatar').order('id', { ascending: false }).limit(500);
    const seen = new Set<string>();
    crowd.value = (data || []).filter(vote => !seen.has(vote.userid) && seen.add(vote.userid))
      .map(vote => ({ userid: vote.userid, avatar: vote.user_avatar || '', songId: vote.songid }));
  }

  watch(theLatestVotes, (votes) => {
    if (!live()) return;
    for (const vote of votes) {
      stageClock.arrivals.push({ userid: vote.userid, avatar: vote.user_avatar, songId: vote.songid });
      const song = allSongs.value.find(item => item.songId === vote.songid)?.song;
      if (song) toast.value = { avatar: vote.user_avatar, song, key: Date.now() };
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.value = null; }, 4000);
  });

  // Dev only: send a pretend vote down the same path the realtime channel uses.
  function simulateVote() {
    const faces = (crowd.value || []).map(fan => fan.avatar).filter(src => /githubusercontent|twimg/.test(src));
    const song = allSongs.value[Math.floor(Math.random() * allSongs.value.length)];
    if (!song) return;
    songStore.latestVote = [{
      userid: `simulated-${Date.now()}`,
      songid: song.songId,
      user_avatar: faces[Math.floor(Math.random() * faces.length)] || '',
    }];
  }

  onMounted(() => { if (live()) void seedCrowd(); });
  onUnmounted(() => {
    clearTimeout(toastTimer);
    stageClock.arrivals.length = 0;
  });

  return { crowd, toast, simulateVote };
}
