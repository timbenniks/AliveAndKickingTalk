<script setup lang="ts">
import type { ShowPhase } from "#shared/show/phase";

// Dev only: a phone's show bar with a made-up voter and a chosen phase, on the
// real 'show' channel. ?uid=fan-1&phase=playing or ?phase=encore&seconds=15.
// Broadcast and presence are ephemeral; nothing is written to the database.
if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: "Page not found" });

const route = useRoute();
const uid = String(route.query.uid || `preview-${Math.random().toString(36).slice(2, 8)}`);
const seconds = Number(route.query.seconds) || 15;
const phase: ShowPhase = route.query.phase === "playing"
  ? { kind: "playing" }
  : route.query.phase === "encore" ? { kind: "encore", endsAt: Date.now() + seconds * 1000 } : { kind: "idle" };
</script>

<template>
  <div>
    <main class="vote-page">
      <header class="vote-head">
        <p class="vote-eyebrow">Preview · {{ uid }}</p>
        <h1 class="vote-title">Phone show bar</h1>
      </header>
    </main>
    <ShowBar :uid="uid" :phase="phase" />
  </div>
</template>
