// Shaking the phone counts as a tap. iOS only shares motion after the user
// grants it from a tap, so `enable` is called from the first button press.
export function useShake(onShake: () => void, threshold = 22) {
  const enabled = ref(false);
  let last = 0;

  function handle(event: DeviceMotionEvent) {
    const a = event.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    const force = Math.hypot(a.x, a.y, a.z);
    const now = performance.now();
    if (force > threshold && now - last > 250) {
      last = now;
      onShake();
    }
  }

  async function enable() {
    if (enabled.value || typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return;
    const motion = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    try {
      if (motion.requestPermission && await motion.requestPermission() !== 'granted') return;
    } catch {
      return;
    }
    window.addEventListener('devicemotion', handle);
    enabled.value = true;
  }

  onUnmounted(() => window.removeEventListener('devicemotion', handle));
  return { enabled, enable };
}
