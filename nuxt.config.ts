import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  devtools: { enabled: true },
  routeRules: {
    '/': { ssr: false },
    '/live': { ssr: false },
    '/slides': { ssr: false },
    '/live/*': { ssr: false },
    '/share/*': { ssr: true },
    '/band': { ssr: false },
    '/stats': { ssr: false },
    '/practise': { ssr: false },
    '/practise/**': { ssr: false },
    '/terms-of-service': { prerender: true },
    '/privacy-policy': { prerender: true },
  },
  modules: ['@nuxtjs/supabase', '@pinia/nuxt', '@nuxt/fonts', '@nuxt/eslint'],
  css: ['~/assets/css/tailwind.css'],
  vite: { plugins: [tailwindcss()] },

  supabase: {
    types: '~~/shared/types/database.ts',
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/share/*', '/live', '/live/*', '/band', '/stats', '/practise', '/practise/*', '/terms-of-service', '/privacy-policy'],
    }
  },

  runtimeConfig: {
    contentstackHost: process.env.GQL_HOST,
    contentstackToken: process.env.ACCESS_TOKEN,
    plausibleKey: process.env.NUXT_PLAUSIBLE_KEY,
    public: {
      maxVotes: process.env.NUXT_MAX_VOTES || '5',
      voteTimeout: process.env.NUXT_VOTE_TIMEOUT || "500",
      conference: process.env.NUXT_CONFERENCE || '',
      showVolume: process.env.NUXT_SHOW_VOLUME || 'false',
    }
  },

  fonts: { families: [{ name: 'Lato', provider: 'google', weights: [100, 300, 400, 700, 900] }] },
  app: {
    head: {
      title: "Alive and Kicking - A Vue into Rock & Roll",

      htmlAttrs: {
        lang: "en",
      },
      meta: [
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1.0"
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
          defer: true,
          'data-domain': "aliveandkicking.dev",
          src: "https://plausible.io/js/script.js"
        },
        {
          key: "plausible",
          textContent: "window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }",
          type: "text/javascript",
        }
      ],
    }
  }
})
