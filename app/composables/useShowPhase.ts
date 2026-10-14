import { parseShowPhase } from '#shared/show/phase';

// What the show is doing right now, as set by the host's live screen. Reads the
// 'show_phase' config row and follows it live, so a phone that joins late still
// gets the current phase.
export function useShowPhase() {
  const client = useSupabaseClient();
  const store = useSongStore();
  const phase = computed(() => parseShowPhase(store.config.find(item => item.key === 'show_phase')?.val));

  function apply(val: unknown) {
    if (typeof val !== 'string') return;
    const row = store.config.find(item => item.key === 'show_phase');
    if (row) row.val = val;
    else store.config.push({ key: 'show_phase', val });
  }

  const channel = client.channel('show-phase')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'config', filter: 'key=eq.show_phase' }, (payload) => {
      apply((payload.new as { val?: unknown } | null)?.val);
    });

  onMounted(() => {
    channel.subscribe((state) => {
      // Catch up on anything missed while connecting.
      if (state === 'SUBSCRIBED') void store.getConfigValues().catch(() => { store.errorMessage = ''; });
    });
  });
  onUnmounted(() => { void client.removeChannel(channel); });

  return phase;
}
