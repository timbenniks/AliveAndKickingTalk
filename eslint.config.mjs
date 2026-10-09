import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  ignores: ['assets/**', 'public/**', 'supabase-backups/**'],
}, {
  rules: {
    'vue/multi-word-component-names': 'off',
  },
})
