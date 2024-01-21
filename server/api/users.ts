import { H3Event } from 'h3';

import { serverSupabaseServiceRole } from '#supabase/server'

export default eventHandler(async (event: H3Event) => {
  const client = serverSupabaseServiceRole(event)

  const { data: { users } } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  })

  return users.map(user => {
    return (user.user_metadata.picture || user.user_metadata.avatar_url).replace('_normal', '')

  })
})