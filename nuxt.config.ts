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
          dataDomain: "aliveandkicking.dev/",
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
