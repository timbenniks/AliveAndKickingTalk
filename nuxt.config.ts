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
  modules: ['@nuxtjs/supabase', '@pinia/nuxt', '@nuxt/fonts', '@nuxt/eslint', '@tresjs/nuxt'],
  css: ['~/assets/css/tailwind.css'],
  components: [
    { path: '~/components/ui', pathPrefix: false },
    { path: '~/components/stage', pathPrefix: false },
    '~/components',
  ],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: { include: ['three'] },
    // three.js is one ~1 MB chunk, loaded only by the stage pages (/live, /practise).
    build: { chunkSizeWarningLimit: 1100 },
  },

  supabase: {
    types: '~~/shared/types/database.ts',
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/styleguide', '/preview/*', '/share/*', '/live', '/live/*', '/band', '/stats', '/practise', '/practise/*', '/terms-of-service', '/privacy-policy'],
    }
  },

  runtimeConfig: {
    contentstackHost: process.env.GQL_HOST,
    contentstackToken: process.env.ACCESS_TOKEN,
    plausibleKey: process.env.NUXT_PLAUSIBLE_KEY,
    public: {
      maxVotes: process.env.NUXT_MAX_VOTES || '5',
      conference: process.env.NUXT_CONFERENCE || '',
      showVolume: process.env.NUXT_SHOW_VOLUME || 'false',
    }
  },

  fonts: {
    families: [
      { name: 'Barlow Semi Condensed', provider: 'google', weights: [400, 500, 700] },
      { name: 'Jersey 10', provider: 'google', weights: [400] },
      { name: 'Silkscreen', provider: 'google', weights: [400, 700] },
    ],
  },
  app: {
    head: {
      title: "Alive and Kicking: Rock Anthem Edition",

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
          name: "theme-color",
          content: "#100c1c"
        },
        {
          property: "og:image",
          content: "https://res.cloudinary.com/dwfcofnrd/image/upload/c_fill,w_1920,h_1080,g_face/f_auto/q_auto/Alive%20and%20Kicking/332022097_722321479543137_5355332749224365662_n.jpg"
        },
        {
          name: "description",
          content: "Vote for the next rock anthem and watch it played live on a voxel stage. Every vote puts your face in the mosh pit. Built with Vue, Nuxt and TresJS."
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
