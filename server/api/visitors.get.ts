export default defineEventHandler(async (event) => {
  const { plausibleKey } = useRuntimeConfig(event);
  if (!plausibleKey) return null;
  try {
    return await $fetch<number>('https://plausible.io/api/v1/stats/realtime/visitors', {
      query: { site_id: 'aliveandkicking.dev' },
      headers: { Authorization: `Bearer ${plausibleKey}` }, timeout: 5000,
    });
  } catch {
    return null;
  }
});
