<script setup lang="ts">
const slides = [
  "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto:best/Alive%20and%20Kicking/slides/1.jpg",
  "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto:best/Alive%20and%20Kicking/slides/2.jpg",
  "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto:best/Alive%20and%20Kicking/slides/3.jpg",
  "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto:best/Alive%20and%20Kicking/slides/4.jpg",
  "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto:best/Alive%20and%20Kicking/slides/5.jpg",
  "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto:best/Alive%20and%20Kicking/slides/6.jpg",
  "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto:best/Alive%20and%20Kicking/slides/7.jpg",
  "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto:best/Alive%20and%20Kicking/slides/8.jpg",
  "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto:best/Alive%20and%20Kicking/slides/9.jpg",
  "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto:best/Alive%20and%20Kicking/slides/10.jpg",
  "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto:best/Alive%20and%20Kicking/slides/11.jpg",
  "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto:best/Alive%20and%20Kicking/slides/12.jpg",
  "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto:best/Alive%20and%20Kicking/slides/13.jpg",
];

const current = ref(0);
const background = ref(slides[current.value]);
const min = 0;
const max = slides.length;

watch(current, (newVal) => {
  console.log(newVal);
  background.value = slides[newVal];
});

function next() {
  if (current.value === max - 1) {
    current.value = -1;
  }

  if (current.value < max) {
    current.value++;
  }
}

function back() {
  if (current.value === min) {
    current.value = slides.length;
  }

  current.value--;
}

window.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowLeft":
      back();
      break;

    case "ArrowRight":
      next();
      break;

    default:
      return;
  }
  e.preventDefault();
});
</script>

<template>
  <Transition>
    <div
      class="bg-cover w-screen h-screen absolute left-0 top-0 bg-center"
      :key="background"
      :style="{
        backgroundImage: `url(${background})`,
      }"
    ></div>
  </Transition>
</template>
