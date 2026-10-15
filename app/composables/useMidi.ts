export function useMidi() {
  const { acquire, release, dispose: _dispose, ...midi } = useNuxtApp().$midiOutput;
  onMounted(acquire);
  onUnmounted(release);
  return midi;
}
