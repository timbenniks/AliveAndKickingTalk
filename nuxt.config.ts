// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/supabase',
    '@uniformdev/uniform-nuxt',
    '@nuxtjs/tailwindcss',
    '@nuxtjs/google-fonts',
    [
      '@pinia/nuxt',
      {
        autoImports: ['defineStore', 'acceptHMRUpdate'],
      },
    ]
  ],
  imports: {
    dirs: ['store'],
  },
  uniform: {
    projectId: process.env.UNIFORM_PROJECT_ID,
    readOnlyApiKey: process.env.UNIFORM_API_KEY,
    outputType: "standard"
  },
  googleFonts: {
    families: {
      Lato: [100, 400, 900],
    }
  },
  app: {
    head: {
      title: "Alive and Kicking",
      htmlAttrs: {
        lang: "en",
      },
      meta: [
        {
          name: "viewport",
          content: "width=device-width; initial-scale=1.0; maximum-scale=1.0; user-scalable=no"
        },
        {
          charset: "utf-8"
        }
      ],
    }
  }
})
