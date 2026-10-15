// Vue adapter: all consumers share the current Nuxt app's audio engine.
export function useStageAudio() {
  const { acquire, release, dispose: _dispose, onTick, ...audio } = useNuxtApp().$stageAudio;
  onMounted(acquire);
  onUnmounted(release);

  function subscribe(handler: () => void) {
    onUnmounted(onTick(handler));
  }

  return { ...audio, onTick: subscribe };
}
