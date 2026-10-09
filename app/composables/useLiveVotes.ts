import type { Database } from '~/types';

export function useLiveVotes(name: string) {
  const client = useSupabaseClient<Database>();
  const store = useSongStore();
  const status = ref('Connecting to live votes…');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let refreshing = false;
  let dirty = false;
  let connected = false;
  let retryDelay = 250;

  async function refresh() {
    if (disposed) return;
    if (refreshing) { dirty = true; return; }
    refreshing = true;
    dirty = false;
    try {
      await Promise.all([store.getVotesForSongs(), store.getPlayedSongs(), store.getConfigValues()]);
      retryDelay = 250;
      if (connected) status.value = "Live votes connected";
    } catch {
      status.value = 'Live state could not refresh. Retrying…';
      retryDelay = 2000;
      dirty = true;
    } finally {
      refreshing = false;
      if (dirty && !disposed) schedule();
    }
  }

  function schedule() {
    if (timer || disposed) return;
    timer = setTimeout(() => { timer = undefined; void refresh(); }, retryDelay);
  }

  const channel = client.channel(name)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, payload => {
      if (payload.eventType === 'INSERT') {
        const vote = payload.new;
        if (typeof vote.userid === 'string' && typeof vote.songid === 'string' && typeof vote.user_avatar === 'string') {
          store.latestVote = [{ userid: vote.userid, songid: vote.songid, user_avatar: vote.user_avatar }];
        }
      }
      schedule();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'songs_played' }, schedule)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, schedule);

  onMounted(() => {
    channel.subscribe(state => {
      connected = state === 'SUBSCRIBED';
      status.value = state === 'SUBSCRIBED' ? 'Live votes connected' : 'Live votes reconnecting…';
      if (state === 'SUBSCRIBED') void refresh();
    });
  });
  onUnmounted(() => {
    disposed = true;
    clearTimeout(timer);
    void client.removeChannel(channel);
  });
  return status;
}
