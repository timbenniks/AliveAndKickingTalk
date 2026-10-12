<script setup lang="ts">
const client = useSupabaseClient();
const loginError = ref("");
const signingIn = ref(false);
const providers = [
  { id: "github", name: "GitHub", icon: "/github.png" },
  { id: "twitter", name: "Twitter", icon: "/twitter.png" },
  { id: "linkedin_oidc", name: "LinkedIn", icon: "/linkedin.png" },
] as const;

const login = async (provider: typeof providers[number]["id"]) => {
  loginError.value = "";
  signingIn.value = true;
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/confirm` },
    });
    if (error) throw error;
  } catch {
    loginError.value = "Sign-in could not start. Please try again.";
  } finally {
    signingIn.value = false;
  }
};

useSeoMeta({
  title: "Alive and Kicking — You vote. I play. | Tim Benniks",
  description: "Part technical talk, part live guitar show. The audience chooses the setlist and the browser runs the performance. Bring Alive and Kicking to your stage.",
  ogTitle: "Alive and Kicking — You vote. I play.",
  ogDescription: "A conference talk with a live soundtrack. By Tim Benniks, with a setlist chosen by you.",
  ogImage: "https://res.cloudinary.com/dwfcofnrd/image/upload/f_auto,q_auto,w_1200/Alive%20and%20Kicking/104649HDV09996-Enhanced-NR.jpg",
});
</script>

<template>
  <main class="show-page">
    <a class="skip-link" href="#about">Skip to the show</a>
    <header class="show-header wrap">
      <a href="#top" aria-label="Alive and Kicking, back to top" class="brand">
        <img src="/logo.png" alt="Alive and Kicking" width="1548" height="1132" >
      </a>
      <span class="byline">A live experience by <a href="https://timbenniks.dev">Tim Benniks</a></span>
      <a class="cta header-vote" href="#join">Sign in to vote <span aria-hidden="true">↗</span></a>
    </header>

    <section id="top" class="show-hero" aria-labelledby="show-title">
      <img
class="hero-photo"
        src="https://res.cloudinary.com/dwfcofnrd/image/upload/f_auto,q_auto,w_1920/Alive%20and%20Kicking/104649HDV09996-Enhanced-NR.jpg"
        alt="Tim playing guitar at Vue.js Amsterdam, with audience votes on the big screen"
        width="1920" height="1280" fetchpriority="high" >
      <div class="hero-shade" aria-hidden="true"/>
      <div class="wrap hero-content">
        <p class="eyebrow">Alive and Kicking · By Tim Benniks</p>
        <h1 id="show-title">You vote.<br ><span class="flowing-title">I play.</span></h1>
        <p class="hero-intro">Your audience chooses the setlist.<br >The browser runs the show.</p>
        <p class="hero-description">Part technical talk. Part live guitar concert. A whole room making something happen together.</p>
        <div class="hero-actions">
          <a class="cta-fancy" href="https://timbenniks.dev/press-kit">Bring it to your stage <span aria-hidden="true">↗</span></a>
          <a class="text-link" href="#join">I’m here to vote <span aria-hidden="true">↓</span></a>
        </div>
        <a class="watch-link" href="https://www.youtube.com/watch?v=p3pm_0p8lZ4" target="_blank" rel="noopener noreferrer">
          <span class="play-icon" aria-hidden="true">▶</span>
          Watch the talk <span class="watch-venue">· Vue.js Amsterdam 2024</span>
          <span class="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <p class="photo-caption">The code. The crowd. The guitar.</p>
    </section>

    <section id="about" class="experience wrap" aria-labelledby="experience-title">
      <div class="section-heading">
        <p class="eyebrow">The audience is part of the show</p>
        <h2 id="experience-title">The crowd becomes<br ><span class="flowing-title">the setlist.</span></h2>
        <p>Phones out. Volume up. Every choice changes what happens on stage.</p>
      </div>
      <ol class="show-steps">
        <li>
          <span class="step-number flowing-title" aria-hidden="true">01</span>
          <h3>Choose your anthems.</h3>
          <p>Sign in on your phone and vote for the songs or mashup you want to hear. Your vote lands on the big screen as a bouncing ball with your profile picture.</p>
        </li>
        <li>
          <span class="step-number flowing-title" aria-hidden="true">02</span>
          <h3>Hear your choices.</h3>
          <p>Tim plays the guitar live. The browser handles backing tracks and amp changes, while you see the architecture behind the performance at work.</p>
        </li>
        <li>
          <span class="step-number flowing-title" aria-hidden="true">03</span>
          <h3>Take the moment home.</h3>
          <p>Your songs. Your face. A personalized image of your picks, ready to share when the last chord rings out.</p>
        </li>
      </ol>
    </section>

    <section class="backstage wrap" aria-labelledby="backstage-title">
      <figure class="share-artwork">
        <img
class="fancy-image"
          src="https://res.cloudinary.com/dwfcofnrd/image/upload/f_auto,q_auto,w_1000/share_ddu23k.jpg"
          alt="Example personalized mashup image with Tim’s portrait and AC/DC, Aerosmith, Metallica and Michael Jackson artwork"
          width="1600" height="900" loading="lazy" >
        <figcaption>A little piece of the show, made for you. Example from ContentCon.</figcaption>
      </figure>
      <div class="backstage-copy">
        <p class="eyebrow">Behind the music</p>
        <h2 id="backstage-title">This is what<br >the web sounds like.</h2>
        <p>Real-time votes become a live performance. Vue, Nuxt and WebMIDI connect the audience to the stage, with Contentstack, Supabase, Cloudinary and Vercel behind the experience.</p>
        <p>The backing tracks are re-recorded in Tim’s studio for this show. AI-created guitar tones and virtual amps give each song its sound. You see how it all works, then hear the result.</p>
        <a class="text-link" href="https://github.com/timbenniks/AliveAndKickingTalk" target="_blank" rel="noopener noreferrer">Explore the code <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>
      </div>
    </section>

    <section class="join-section" aria-label="Bring the show to your event or join the audience">
      <div class="wrap join-grid">
        <div class="booking">
          <p class="eyebrow">For the people putting on the show</p>
          <h2>Give your stage<br ><span class="flowing-title">a guitar solo.</span></h2>
          <p>A session with technical substance, a room full of participants and the energy of live music. Let’s bring Alive and Kicking to your next event.</p>
          <a class="cta-fancy" href="https://timbenniks.dev/press-kit">Talk to Tim about your event <span aria-hidden="true">↗</span></a>
        </div>
        <div id="join" class="audience fancy-image" aria-labelledby="join-title" tabindex="-1">
          <p class="eyebrow">In the audience?</p>
          <h2 id="join-title">Your turn.<br >Pick the next song.</h2>
          <p>Sign in to vote and see your profile picture on the big screen.</p>
          <div class="sign-in-buttons" :aria-busy="signingIn">
            <button
v-for="provider in providers" :key="provider.id"
              class="cta provider-button" :disabled="signingIn" @click="login(provider.id)">
              <img :src="provider.icon" alt="" width="32" height="32" loading="lazy" >
              <span>Continue with {{ provider.name }}</span>
              <span class="provider-arrow" aria-hidden="true">↗</span>
            </button>
          </div>
          <p v-if="signingIn" class="login-status" role="status">Opening sign-in…</p>
          <p v-if="loginError" class="login-status" role="alert">{{ loginError }}</p>
          <p class="privacy-note">Your profile connects your votes to you. <NuxtLink to="/privacy-policy">Privacy policy</NuxtLink></p>
        </div>
      </div>
    </section>

    <footer class="show-footer wrap">
      <p>Alive and Kicking <span>by <a href="https://timbenniks.dev">Tim Benniks</a></span></p>
      <div><NuxtLink to="/privacy-policy">Privacy</NuxtLink><NuxtLink to="/terms-of-service">Terms</NuxtLink><a href="#top">Back to top ↑</a></div>
    </footer>
  </main>
</template>

<style scoped>
.show-page { --muted: #b9b9c5; background: #000; }
.wrap { width: min(1240px, calc(100% - 96px)); margin-inline: auto; }
.show-page a:focus-visible, .show-page button:focus-visible { outline: 3px solid #fff; outline-offset: 6px; }
.show-page a { text-decoration-thickness: 1px; }
.show-page .cta, .show-page .cta-fancy { display: inline-flex; width: auto; align-items: center; justify-content: center; gap: 16px; min-height: 48px; padding: 12px 20px; transition: filter .2s; }
.show-page .cta:hover, .show-page .cta-fancy:hover { filter: brightness(1.25); }
.show-page .cta:disabled { cursor: wait; opacity: .6; }
.skip-link { position: absolute; top: 8px; left: 8px; z-index: 10; padding: 12px; background: #000; transform: translateY(-150%); }
.skip-link:focus { transform: none; }
.show-header { position: relative; z-index: 2; display: flex; align-items: center; gap: 28px; padding-block: 22px; }
.brand { display: block; width: 114px; flex-shrink: 0; }
.byline { color: var(--muted); font-size: 14px; }
.byline a { color: #fff; text-decoration: none; }
.show-header .header-vote { margin-left: auto; }
.show-hero { min-height: 700px; position: relative; display: flex; align-items: center; isolation: isolate; }
.hero-photo { position: absolute; inset: 0 0 0 auto; height: 100%; width: 76%; object-fit: cover; object-position: 55% center; z-index: -3; }
.hero-shade { position: absolute; inset: 0; z-index: -2; background: linear-gradient(90deg, #000 6%, rgba(0,0,0,.93) 27%, rgba(0,0,0,.45) 52%, rgba(0,0,0,.08) 75%), linear-gradient(0deg, #000, transparent 28%); }
.hero-content { padding-block: 54px 90px; }
.eyebrow { font-size: 12px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; margin-bottom: 22px; color: #e5e5e5; }
h1, h2, h3 { font-weight: 900; }
h1 { font-size: clamp(76px, 8.8vw, 126px); line-height: .95; letter-spacing: -.055em; text-transform: uppercase; margin-bottom: 30px; }
.hero-intro { font-size: clamp(21px, 2.1vw, 27px); line-height: 1.4; max-width: 520px; }
.hero-description { max-width: 410px; margin-top: 18px; color: var(--muted); line-height: 1.7; font-size: 17px; }
.hero-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 22px; margin-top: 30px; }
.text-link { display: inline-flex; align-items: center; gap: 12px; font-size: 15px; font-weight: 700; text-underline-offset: 5px; }
.watch-link { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 30px; font-size: 13px; color: #e5e5e5; text-decoration: none; }
.watch-link:hover { text-decoration: underline; }
.play-icon { font-size: 11px; }
.watch-venue { color: var(--muted); }
.photo-caption { position: absolute; right: 48px; bottom: 45px; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #e5e5e5; }
.experience { padding-block: 100px 90px; }
h2 { font-size: clamp(34px, 4.3vw, 56px); line-height: 1.06; letter-spacing: -.035em; text-transform: uppercase; }
.section-heading > p:last-child { color: var(--muted); margin-top: 22px; font-size: 19px; }
.show-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 44px; margin-top: 56px; list-style: none; }
.show-steps li { border-top: 1px solid #30303a; padding-top: 24px; }
.step-number { display: inline-block; font-size: 33px; font-weight: 900; line-height: 1; margin-bottom: 18px; }
h3 { font-size: 22px; margin-bottom: 14px; }
.show-steps p, .backstage-copy p:not(.eyebrow), .booking > p:not(.eyebrow), .audience > p:not(.eyebrow) { color: var(--muted); font-size: 17px; line-height: 1.75; }
.backstage { display: grid; grid-template-columns: 1.1fr 1fr; align-items: center; gap: 72px; padding-block: 50px 110px; }
.share-artwork { transform: rotate(-3deg); }
.share-artwork img { display: block; aspect-ratio: 16 / 9; }
figcaption { font-size: 12px; line-height: 1.6; color: var(--muted); margin-top: 15px; }
.backstage h2 { font-size: clamp(32px, 3.2vw, 43px); margin-bottom: 24px; }
.backstage-copy p:not(.eyebrow) { margin-bottom: 20px; }
.join-section { border-top: 1px solid #30303a; background: linear-gradient(135deg, rgba(37,106,209,.09), transparent 50%, rgba(209,37,140,.06)); padding-block: 90px; }
.join-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 100px; align-items: center; }
.booking > p:not(.eyebrow) { margin-block: 28px; max-width: 430px; }
.booking h2 { font-size: clamp(36px, 4vw, 52px); }
.audience { padding: 38px; background: #08080c; scroll-margin-top: 24px; }
.audience h2 { font-size: clamp(30px, 3vw, 38px); margin-bottom: 18px; }
.audience .eyebrow { margin-bottom: 16px; }
.sign-in-buttons { display: grid; gap: 12px; margin-top: 25px; }
.sign-in-buttons .provider-button { width: 100%; justify-content: flex-start; font-size: 12px; }
.provider-button img { width: 24px; height: 24px; object-fit: contain; flex-shrink: 0; }
.provider-arrow { margin-left: auto; }
.audience .privacy-note, .audience .login-status { font-size: 12px; margin-top: 18px; }
.privacy-note a { color: #fff; }
.show-footer { display: flex; justify-content: space-between; gap: 24px; padding-block: 34px; font-size: 13px; }
.show-footer p { font-weight: 900; }
.show-footer p span { color: var(--muted); font-weight: 400; margin-left: 8px; }
.show-footer div { display: flex; gap: 24px; color: var(--muted); }
@media (min-width: 1600px) { .show-hero { min-height: 790px; } }
@media (max-width: 1000px) {
  .wrap { width: calc(100% - 56px); }
  .byline { display: none; }
  .show-hero { min-height: 690px; }
  .hero-photo { width: 100%; object-position: 63% center; }
  .hero-shade { background: linear-gradient(90deg, rgba(0,0,0,.93), rgba(0,0,0,.7) 45%, rgba(0,0,0,.3)), linear-gradient(0deg, #000, transparent 35%); }
  .photo-caption { right: 28px; bottom: 20px; }
  .show-steps { gap: 26px; }
  .backstage { gap: 40px; }
  .join-grid { gap: 40px; }
  .audience { padding: 26px; }
}
@media (max-width: 700px) {
  .wrap { width: calc(100% - 40px); }
  .show-header { padding-block: 14px; }
  .brand { width: 85px; }
  .show-header .header-vote { font-size: 11px; padding: 10px 12px; gap: 10px; }
  .show-hero { min-height: auto; padding-top: 175px; }
  .hero-photo { height: 400px; object-position: center 42%; }
  .hero-shade { background: linear-gradient(0deg, #000 10%, #000 30%, rgba(0,0,0,.7) 60%, rgba(0,0,0,.02) 100%); }
  .hero-content { padding-block: 40px 30px; }
  .eyebrow { font-size: 10px; letter-spacing: .12em; margin-bottom: 20px; }
  h1 { font-size: clamp(64px, 16vw, 100px); margin-bottom: 24px; }
  .hero-description { font-size: 16px; max-width: 340px; }
  .hero-actions { gap: 24px; }
  .watch-link { font-size: 12px; gap: 8px; }
  .photo-caption { display: none; }
  .experience { padding-block: 60px; }
  .section-heading > p:last-child { font-size: 17px; line-height: 1.6; }
  .show-steps { grid-template-columns: 1fr; gap: 28px; margin-top: 32px; }
  .show-steps li { position: relative; padding-left: 50px; }
  .step-number { position: absolute; left: 0; top: 25px; font-size: 26px; }
  h3 { font-size: 21px; margin-bottom: 10px; }
  .show-steps p { font-size: 16px; }
  .backstage { grid-template-columns: 1fr; gap: 42px; padding-block: 20px 60px; }
  .share-artwork { margin: 8px; }
  .join-section { padding-block: 56px; }
  .join-grid { grid-template-columns: 1fr; gap: 44px; }
  .audience { padding: 28px 22px; }
  .show-footer { flex-direction: column; font-size: 12px; }
  .show-footer div { gap: 22px; }
}
@media (prefers-reduced-motion: reduce) { .show-page .cta, .show-page .cta-fancy { transition: none; } }
</style>
