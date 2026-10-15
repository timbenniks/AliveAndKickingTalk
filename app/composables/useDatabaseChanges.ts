import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '~/types';

type DatabaseChange = {
  table: 'votes' | 'config' | 'songs_played' | 'votes_per_song';
  event: 'UPDATE' | 'INSERT' | 'DELETE' | '*';
  callback: (payload: { eventType: string; new: Record<string, unknown> }) => void | Promise<void>;
};

export function useDatabaseChanges(name: string, changes: DatabaseChange[]) {
  const client = useSupabaseClient<Database>();
  let channel: RealtimeChannel | null = null;

  onMounted(() => {
    channel = client.channel(name);
    for (const change of changes) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: change.table }, payload => {
        if (change.event === '*' || change.event === payload.eventType) void change.callback(payload);
      });
    }
    channel.subscribe();
  });

  onUnmounted(() => {
    if (channel) void client.removeChannel(channel);
    channel = null;
  });
}
