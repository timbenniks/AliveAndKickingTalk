import type { RealtimeChannel } from '@supabase/supabase-js';

// One realtime channel for the show. Phones broadcast taps and track
// themselves in presence; the stage listens and counts the room. Broadcast and
// presence are ephemeral: nothing here touches the database.

type ShowEvent = 'tap' | 'encore';
type TapHandler = (uid: string) => void;

export function useShowChannel(role: 'stage' | 'phone', uid?: () => string) {
  const client = useSupabaseClient();
  const audience = ref(0);
  const connected = ref(false);
  const handlers: Record<ShowEvent, Set<TapHandler>> = { tap: new Set(), encore: new Set() };
  let channel: RealtimeChannel | null = null;

  function receive(event: ShowEvent) {
    return ({ payload }: { payload: { uid?: unknown } }) => {
      if (typeof payload?.uid !== 'string' || !payload.uid) return;
      for (const handler of handlers[event]) handler(payload.uid);
    };
  }

  onMounted(() => {
    const key = role === 'phone' ? uid?.() : undefined;
    channel = client.channel('show', { config: { broadcast: { self: false }, presence: { key: key || '' } } });
    if (role === 'stage') {
      channel
        .on('broadcast', { event: 'tap' }, receive('tap'))
        .on('broadcast', { event: 'encore' }, receive('encore'))
        .on('presence', { event: 'sync' }, () => {
          audience.value = Object.keys(channel?.presenceState() ?? {}).length;
        });
    }
    channel.subscribe((state) => {
      connected.value = state === 'SUBSCRIBED';
      if (connected.value && role === 'phone' && key) void channel?.track({ uid: key });
    });
  });

  onUnmounted(() => {
    if (channel) void client.removeChannel(channel);
    channel = null;
  });

  // Phones: send one tap. Callers rate-limit first.
  function send(event: ShowEvent) {
    const id = uid?.();
    if (!channel || !connected.value || !id) return false;
    void channel.send({ type: 'broadcast', event, payload: { uid: id } });
    return true;
  }

  // Stage: react to taps; returns an unsubscribe.
  function on(event: ShowEvent, handler: TapHandler) {
    handlers[event].add(handler);
    return () => { handlers[event].delete(handler); };
  }

  return { audience, connected, send, on };
}
