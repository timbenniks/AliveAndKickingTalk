import { serverSupabaseServiceRole } from '#supabase/server';

export default defineCachedEventHandler(async (event) => {
  const client = serverSupabaseServiceRole(event);
  const avatars: string[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw createError({ statusCode: 502, statusMessage: 'Unable to load voter avatars' });
    avatars.push(...data.users.map(user => String(user.user_metadata?.picture || user.user_metadata?.avatar_url || '')));
    if (!data.nextPage) break;
    page = data.nextPage;
  }
  return avatars;
}, { maxAge: 60, swr: false, name: 'public-voter-avatars' });
