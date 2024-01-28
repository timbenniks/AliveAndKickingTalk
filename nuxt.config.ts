export default defineNuxtConfig({
  devtools: { enabled: false },
  routeRules: {
    '/': { ssr: false },
    '/live': { ssr: false },
    '/slides': { ssr: false },
    '/live/*': { ssr: false },
    '/share/*': { ssr: true },
    '/band': { ssr: false },
    '/stats': { ssr: false },
    '/terms-of-service': { prerender: true },
    '/privacy-policy': { prerender: true },
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
    ],
    'nuxt-graphql-client'
  ],
  imports: {
    dirs: ['store'],
  },

  supabase: {
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/share/*', '/live', '/live/*', '/band', '/stats', '/practise'],
    }
  },

  runtimeConfig: {
    public: {
      maxVotes: process.env.NUXT_MAX_VOTES,
      voteTimeout: process.env.NUXT_VOTE_TIMEOUT || "500",
      conference: process.env.NUXT_CONFERENCE,
      showVolume: process.env.NUXT_SHOW_VOLUME,
      plausibleKey: process.env.NUXT_PLAUSIBLE_KEY,
    }
  },

  googleFonts: {
    families: {
      Lato: [100, 500, 900],
    }
  },
  app: {
    head: {
      title: "Alive and Kicking - A Vue into Rock & Roll",

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
        },
        {
          property: "og:image",
          content: "https://res.cloudinary.com/dwfcofnrd/image/upload/c_fill,w_1920,h_1080,g_face/f_auto/q_auto/Alive%20and%20Kicking/332022097_722321479543137_5355332749224365662_n.jpg"
        },
        {
          name: "description",
          content: "This is the Vue guitar Karaoke talk. The audience can vote for a song to be played live on stage. The whole experience is done in the browser and uses Vue and Nuxt."
        }
      ],
      script: [
        {
          defer: "true",
          //@ts-ignore
          dataDomain: "aliveandkicking.dev",
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
