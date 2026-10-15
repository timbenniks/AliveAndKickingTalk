import { ref, watch } from 'vue';
import { readPreference, writePreference } from './preferences.ts';

export function createRigDisplay() {
  const key = 'alive-rig-display';
  const forceReduced = ref(false);
  const lowQuality = ref(false);
  const showGuitarNotes = ref(true);
  let loaded = false;

  const stop = watch([forceReduced, lowQuality, showGuitarNotes], () => {
    if (!loaded) return;
    writePreference(key, JSON.stringify({
      forceReduced: forceReduced.value,
      lowQuality: lowQuality.value,
      showGuitarNotes: showGuitarNotes.value,
    }));
  }, { flush: 'sync' });

  function load() {
    if (loaded) return;
    try {
      const saved = JSON.parse(readPreference(key) || '{}');
      forceReduced.value = saved.forceReduced === true;
      lowQuality.value = saved.lowQuality === true;
      showGuitarNotes.value = saved.showGuitarNotes !== false;
    } catch { /* Defaults remain available when preferences are invalid. */ }
    loaded = true;
  }

  return { forceReduced, lowQuality, showGuitarNotes, load, dispose: stop };
}
