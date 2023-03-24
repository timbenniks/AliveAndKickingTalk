export default defineNuxtConfig({
  routeRules: {
    '/': { ssr: false },
    '/live': { ssr: false },
    '/slides': { ssr: false },
    '/live/**': { ssr: false },
  },
  modules: [
    '@nuxtjs/supabase',
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
          content: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        },
        {
          charset: "utf-8"
        }
      ],
      script: [
        {
          defer: "true",
          dataDomain: "aliveandkicking.vercel.app",
          src: "https://plausible.io/js/script.js"
        },
        {
          hid: "plausible",
          children: "window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }",
          type: "text/javascript",
        }
      ],
    }
  }
})
