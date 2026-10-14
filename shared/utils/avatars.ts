// Which provider avatars the server may copy into our storage, and from where.
const AVATAR_HOSTS = new Set(['media.licdn.com', 'avatars.githubusercontent.com', 'pbs.twimg.com', 'abs.twimg.com'])

// Returns the URL to fetch, or null when the avatar isn't one we copy.
// X serves a 48px "_normal" image by default; the plain name is the full size.
export function avatarSource(provider: string): string | null {
  try {
    const url = new URL(provider.replace('_normal', ''))
    return url.protocol === 'https:' && AVATAR_HOSTS.has(url.hostname) ? url.href : null
  } catch {
    return null
  }
}
