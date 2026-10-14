import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server';
import { avatarSource } from '#shared/utils/avatars';

// Provider avatar URLs expire (LinkedIn especially), which leaves old voters
// faceless. This copies the signed-in voter's avatar into the public 'avatars'
// bucket once and returns a URL that keeps working. Anything unexpected (no
// bucket yet, a host we don't know, a slow or odd response) falls back to the
// provider URL, so voting never depends on it.

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const MAX_BYTES = 1024 * 1024;

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user?.sub) throw createError({ statusCode: 401, statusMessage: 'Sign in first' });

  const meta = (user.user_metadata || {}) as { avatar_url?: string; picture?: string };
  const provider = String(meta.avatar_url || meta.picture || '');
  const fallback = { url: provider, stored: false };
  const source = avatarSource(provider);
  if (!source) return fallback;

  try {
    const response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(5000) });
    const type = response.headers.get('content-type')?.split(';')[0]?.trim() || '';
    const extension = TYPES[type];
    if (!response.ok || !extension) return fallback;
    if (Number(response.headers.get('content-length') || 0) > MAX_BYTES) return fallback;
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength === 0 || body.byteLength > MAX_BYTES) return fallback;

    const storage = serverSupabaseServiceRole(event).storage.from('avatars');
    const path = `${user.sub}.${extension}`;
    const { error } = await storage.upload(path, body, { contentType: type, upsert: true, cacheControl: '86400' });
    if (error) return fallback;
    return { url: storage.getPublicUrl(path).data.publicUrl, stored: true };
  } catch {
    return fallback;
  }
});
