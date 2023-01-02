<script setup lang="ts"></script>

<template>
  <main
    class="bg-cover w-screen h-screen"
    :style="{
      backgroundImage:
        'url(https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto/Alive%20and%20Kicking/Still%20Got%20The%20Blues/1.jpg)',
    }"
  >
    <div class="grid grid-cols-5 h-screen w-screen">
      <div class="col-span-4 relative">
        <player />
      </div>
      <div class="bg-black bg-opacity-60 col-span-1"><p>NEXT UP</p></div>
    </div>
    <!-- <live-votes /> -->
    <!-- <midi /> -->
  </main>
</template>
