// Once per session after sign-in, copy the voter's avatar to our own storage
// (server/api/avatar.post.ts) so votes and shares keep a face that never
// expires. Any failure is silent: the provider URL stays in use.
const CACHE_KEY = 'alive-avatar';

export default defineNuxtPlugin(() => {
  const user = useSupabaseUser();
  const store = useSongStore();

  watch(() => user.value?.sub, async (sub) => {
    if (!sub) {
      store.stableAvatar = '';
      return;
    }
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached?.sub === sub && cached.url) {
        store.stableAvatar = cached.url;
        return;
      }
    } catch { /* Private mode or bad cache: fetch it again. */ }

    try {
      const { url, stored } = await $fetch<{ url: string; stored: boolean }>('/api/avatar', { method: 'POST' });
      if (!stored || !url) return;
      store.stableAvatar = url;
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ sub, url })); } catch { /* Not cached: fine. */ }
    } catch { /* Keep the provider avatar. */ }
  }, { immediate: true });
});
