import { normalizeSong, songsQuery } from '../lib/contentstack';

export default defineCachedEventHandler(async (event) => {
  const { contentstackHost, contentstackToken } = useRuntimeConfig(event);
  if (!contentstackHost || !contentstackToken) {
    throw createError({ statusCode: 503, statusMessage: 'Contentstack is not configured' });
  }
  try {
    const result = await $fetch<{
      data?: { all_song: { total: number; items: Parameters<typeof normalizeSong>[0][] } };
      errors?: unknown[];
    }>(contentstackHost, {
      method: 'POST', headers: { access_token: contentstackToken },
      body: { query: songsQuery }, timeout: 15000,
    });
    const songs = result.data?.all_song;
    if (result.errors?.length || !songs || songs.total !== songs.items.length) {
      throw new Error('Incomplete Contentstack response');
    }
    return songs.items.map(normalizeSong);
  } catch {
    // Do not expose upstream request headers or credentials in error responses.
    throw createError({ statusCode: 502, statusMessage: 'Unable to load songs from Contentstack' });
  }
}, { maxAge: 60, swr: false, name: 'song-catalogue' });
