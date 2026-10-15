export function useRigDisplay() {
  const { load, dispose: _dispose, ...display } = useNuxtApp().$rigDisplay;
  onMounted(load);
  return display;
}
