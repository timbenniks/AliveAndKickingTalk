// The Rig's motion and quality toggles. Songs load as new pages, and /config
// sets these too, so they live in localStorage like the rest of the Rig.

const KEY = 'alive-rig-display';

const forceReduced = ref(false);
const lowQuality = ref(false);
let loaded = false;

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ forceReduced: forceReduced.value, lowQuality: lowQuality.value })); } catch { /* Private mode: settings are per session. */ }
}

watch([forceReduced, lowQuality], save);

export function useRigDisplay() {
  onMounted(() => {
    if (loaded) return;
    loaded = true;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      forceReduced.value = saved.forceReduced === true;
      lowQuality.value = saved.lowQuality === true;
    } catch { /* Nothing saved yet. */ }
  });
  return { forceReduced, lowQuality };
}
