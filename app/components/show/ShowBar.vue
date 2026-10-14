<script setup lang="ts">
import type { ShowPhase } from "#shared/show/phase";
import { createTapLimiter } from "#shared/show/taps";

// The phone's part in the show, pinned to the bottom of the vote screen. While
// the song plays: ROCK! (tap or shake) fills the meter on the big screen.
// During an encore vote: ENCORE! with a countdown. Between songs it hides, so
// voting has the screen to itself.
const props = defineProps<{ uid?: string; phase?: ShowPhase }>();

const user = useSupabaseUser();
const uid = computed(() => props.uid || user.value?.sub || "");
const livePhase = props.phase ? null : useShowPhase();
const phase = computed<ShowPhase>(() => props.phase ?? livePhase?.value ?? { kind: "idle" });

const channel = useShowChannel("phone", () => uid.value);
const limiter = createTapLimiter(8);
const taps = ref(0);
const joinedEncore = ref(false);

const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | undefined;
onMounted(() => { clock = setInterval(() => { now.value = Date.now(); }, 250); });
onUnmounted(() => clearInterval(clock));

const secondsLeft = computed(() => phase.value.kind === "encore" ? Math.max(0, Math.ceil((phase.value.endsAt - now.value) / 1000)) : 0);
const mode = computed(() => {
  if (phase.value.kind === "encore" && secondsLeft.value > 0) return "encore";
  if (phase.value.kind === "playing") return "rock";
  return null;
});
watch(mode, (next) => { if (next !== "encore") joinedEncore.value = false; });

function rock() {
  if (!limiter.allow(Date.now())) return;
  if (!channel.send("tap")) return;
  taps.value += 1;
  navigator.vibrate?.(10);
}
const shake = useShake(() => { if (mode.value === "rock") rock(); });

function tapRock() {
  void shake.enable();
  rock();
}

function tapEncore() {
  if (!limiter.allow(Date.now()) || !channel.send("encore")) return;
  joinedEncore.value = true;
  navigator.vibrate?.(20);
}
</script>

<template>
  <div v-if="mode" class="show-spacer" aria-hidden="true" />
  <Transition name="show-bar">
    <aside v-if="mode" class="show-bar" aria-live="polite">
      <template v-if="mode === 'rock'">
        <p class="show-hint">
          <span class="show-label">Live now</span>
          {{ shake.enabled.value ? "Tap or shake to fill the meter" : "Tap to fill the meter on the big screen" }}
        </p>
        <PixelButton size="lg" class="show-button" @click="tapRock">ROCK!</PixelButton>
      </template>
      <template v-else>
        <p class="show-hint">
          <span class="show-label">Encore vote · {{ secondsLeft }} s</span>
          {{ joinedEncore ? "You're in. Keep the room shouting." : "Tap to ask for one more song" }}
        </p>
        <PixelButton size="lg" class="show-button" @click="tapEncore">ENCORE!</PixelButton>
      </template>
    </aside>
  </Transition>
</template>

<style>
/* Room under the vote list so the bar never covers a song. */
.show-spacer { height: 7.5rem; }
.show-bar {
  position: fixed;
  inset: auto 0 0;
  /* Under the mashup picker (z 10) and its busy overlay (z 20). */
  z-index: 5;
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem max(1rem, calc((100% - 560px) / 2)) calc(0.875rem + env(safe-area-inset-bottom));
  background: var(--color-night);
  box-shadow: 0 calc(var(--px) * -1) 0 var(--color-ink), 0 calc(var(--px) * -2) 0 var(--color-tolex-hi);
  font-family: var(--font-sans);
  color: var(--color-bone);
}
.show-hint { font-size: 0.95rem; line-height: 1.25; color: var(--color-dust); }
.show-label { display: block; font-family: var(--font-caps); font-size: 0.65rem; text-transform: uppercase; color: var(--color-gold); margin-bottom: 0.25rem; }
.show-button { flex: none; min-width: 9.5rem; }
.show-bar-enter-active, .show-bar-leave-active { transition: transform 200ms steps(4); }
.show-bar-enter-from, .show-bar-leave-to { transform: translateY(100%); }
@media (prefers-reduced-motion: reduce) {
  .show-bar-enter-active, .show-bar-leave-active { transition: none; }
}
</style>
