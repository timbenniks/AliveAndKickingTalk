// The Rig's motion and quality toggles. Songs load as new pages, and /config
// sets these too, so they live in localStorage like the rest of the Rig.

const KEY = 'alive-rig-display';

const forceReduced = ref(false);
const lowQuality = ref(false);
const showGuitarNotes = ref(true);
let loaded = false;

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ forceReduced: forceReduced.value, lowQuality: lowQuality.value, showGuitarNotes: showGuitarNotes.value })); } catch { /* Private mode: settings are per session. */ }
}

watch([forceReduced, lowQuality, showGuitarNotes], save);

export function useRigDisplay() {
  onMounted(() => {
    if (loaded) return;
    loaded = true;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      forceReduced.value = saved.forceReduced === true;
      lowQuality.value = saved.lowQuality === true;
      showGuitarNotes.value = saved.showGuitarNotes !== false;
    } catch { /* Nothing saved yet. */ }
  });
  return { forceReduced, lowQuality, showGuitarNotes };
}
