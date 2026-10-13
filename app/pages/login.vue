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
  title: "Alive and Kicking: Rock Anthem Edition | You vote. I play.",
  description: "Part technical talk, part live guitar show. The audience chooses the setlist and the browser runs the performance. Bring Alive and Kicking to your stage.",
  ogTitle: "Alive and Kicking: Rock Anthem Edition. You vote. I play.",
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
      <span class="byline">A live show by <a href="https://timbenniks.dev">Tim Benniks</a></span>
      <a class="stompbox px-frame stompbox-secondary stompbox-md header-vote" href="#join">Sign in to vote</a>
    </header>

    <section id="top" class="show-hero" aria-labelledby="show-title">
      <img
        class="hero-photo"
        src="https://res.cloudinary.com/dwfcofnrd/image/upload/f_auto,q_auto,w_1920/Alive%20and%20Kicking/104649HDV09996-Enhanced-NR.jpg"
        alt="Tim playing guitar at Vue.js Amsterdam, with audience votes on the big screen"
        width="1920" height="1280" fetchpriority="high" >
      <div class="hero-shade" aria-hidden="true"/>
      <div class="wrap hero-content">
        <p class="eyebrow">Rock Anthem Edition · By Tim Benniks</p>
        <h1 id="show-title">You vote.<br ><span class="gold">I play.</span></h1>
        <p class="hero-intro">The audience picks the setlist.<br >The browser runs the show.</p>
        <p class="hero-description">Part technical talk. Part live guitar concert. A whole room making something happen together.</p>
        <div class="hero-actions">
          <a class="stompbox px-frame stompbox-primary stompbox-lg" href="#join">Sign in to vote</a>
          <a class="text-link" href="https://timbenniks.dev/press-kit">Bring it to your stage <span aria-hidden="true">↗</span></a>
        </div>
        <a class="watch-link" href="https://www.youtube.com/watch?v=p3pm_0p8lZ4" target="_blank" rel="noopener noreferrer">
          <span class="play-icon" aria-hidden="true">▶</span>
          Watch the talk <span class="watch-venue">· Vue.js Amsterdam 2024</span>
          <span class="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </section>
    <FretStrip class="hero-frets" />

    <section id="about" class="experience wrap" aria-labelledby="experience-title">
      <div class="section-heading">
        <p class="eyebrow">The audience is part of the show</p>
        <h2 id="experience-title">The crowd becomes<br ><span class="gold">the setlist.</span></h2>
        <p>Phones out. Volume up. Every vote changes what happens on stage.</p>
      </div>
      <ol class="show-steps">
        <li>
          <span class="step-number" aria-hidden="true">1</span>
          <h3>Pick your anthems.</h3>
          <p>Sign in on your phone and vote for the songs you want to hear. Your profile picture stage-dives into the crowd on the big screen.</p>
        </li>
        <li>
          <span class="step-number" aria-hidden="true">2</span>
          <h3>Hear your picks.</h3>
          <p>Tim plays guitar live over a voxel stage. The browser runs the backing tracks, the amp changes and the lights, and you see how it all works.</p>
        </li>
        <li>
          <span class="step-number" aria-hidden="true">3</span>
          <h3>Take the moment home.</h3>
          <p>Your songs and your face on one image, ready to share when the last chord rings out.</p>
        </li>
      </ol>
    </section>

    <section class="backstage wrap" aria-labelledby="backstage-title">
      <figure class="share-artwork">
        <img
          class="px-frame"
          src="https://res.cloudinary.com/dwfcofnrd/image/upload/f_auto,q_auto,w_1000/share_ddu23k.jpg"
          alt="Example share image with Tim’s portrait and AC/DC, Aerosmith, Metallica and Michael Jackson artwork"
          width="1600" height="900" loading="lazy" >
        <figcaption>A share image from an earlier show.</figcaption>
      </figure>
      <div class="backstage-copy">
        <p class="eyebrow">Behind the music</p>
        <h2 id="backstage-title">This is what<br >the web sounds like.</h2>
        <p>Live votes become a live performance. Vue, Nuxt, three.js and WebMIDI connect the audience to the stage, with Contentstack, Supabase, Cloudinary and Vercel behind the show.</p>
        <p>Tim re-recorded the backing tracks in his studio for this show. Virtual amps give each song its sound. You see how it works, then hear the result.</p>
        <a class="text-link" href="https://github.com/timbenniks/AliveAndKickingTalk" target="_blank" rel="noopener noreferrer">Explore the code <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>
      </div>
    </section>

    <section class="join-section" aria-label="Bring the show to your event or join the audience">
      <div class="wrap join-grid">
        <div class="booking">
          <p class="eyebrow">For event organisers</p>
          <h2>Give your stage<br ><span class="gold">a guitar solo.</span></h2>
          <p>A session with technical substance, a room full of participants and the energy of live music.</p>
          <a class="text-link" href="https://timbenniks.dev/press-kit">Talk to Tim about your event <span aria-hidden="true">↗</span></a>
        </div>
        <div id="join" class="audience px-frame" aria-labelledby="join-title" tabindex="-1">
          <p class="eyebrow">In the audience?</p>
          <h2 id="join-title">Your turn.<br >Pick the next song.</h2>
          <p>Sign in to vote. Your profile picture joins the crowd on the big screen.</p>
          <div class="sign-in-buttons" :aria-busy="signingIn">
            <PixelButton
              v-for="(provider, index) in providers"
              :key="provider.id"
              :variant="index === 0 ? 'primary' : 'secondary'"
              class="provider-button"
              :disabled="signingIn"
              @click="login(provider.id)"
            >
              <img :src="provider.icon" alt="" width="32" height="32" loading="lazy" >
              <span>Continue with {{ provider.name }}</span>
            </PixelButton>
          </div>
          <p v-if="signingIn" class="login-status" role="status">Opening sign-in…</p>
          <p v-if="loginError" class="login-status login-error" role="alert">{{ loginError }}</p>
          <p class="privacy-note">Signing in links your votes to your profile. <NuxtLink to="/privacy-policy">Privacy policy</NuxtLink></p>
        </div>
      </div>
    </section>

    <footer class="show-footer wrap">
      <p>Alive and Kicking <span>by <a href="https://timbenniks.dev">Tim Benniks</a></span></p>
      <div><NuxtLink to="/privacy-policy">Privacy</NuxtLink><NuxtLink to="/terms-of-service">Terms</NuxtLink><a href="#top">Back to top</a></div>
    </footer>
  </main>
</template>

<style scoped>
.show-page { background: var(--color-night); color: var(--color-bone); font-family: var(--font-sans); overflow-x: hidden; }
.wrap { width: min(1240px, calc(100% - 96px)); margin-inline: auto; }
.show-page a:focus-visible, .show-page button:focus-visible, .audience:focus-visible { outline: var(--px) solid var(--color-fret-4); outline-offset: var(--px); }
.gold { color: var(--color-gold); }
.skip-link { position: absolute; top: 8px; left: 8px; z-index: 10; padding: 12px; background: var(--color-night); transform: translateY(-150%); }
.skip-link:focus { transform: none; }

.show-header { position: relative; z-index: 2; display: flex; align-items: center; gap: 28px; padding-block: 22px; }
.brand { display: block; width: 114px; flex-shrink: 0; }
.brand img { width: 100%; height: auto; }
.byline { color: var(--color-dust); font-size: 15px; }
.byline a { color: var(--color-bone); text-decoration: none; }
.show-header .header-vote { margin-left: auto; }

.show-hero { min-height: 680px; position: relative; display: flex; align-items: center; isolation: isolate; }
.hero-photo { position: absolute; inset: 0 0 0 auto; height: 100%; width: 76%; object-fit: cover; object-position: 55% center; z-index: -3; }
.hero-shade { position: absolute; inset: 0; z-index: -2; background: linear-gradient(90deg, var(--color-night) 6%, color-mix(in srgb, var(--color-night) 93%, transparent) 27%, color-mix(in srgb, var(--color-night) 45%, transparent) 52%, transparent 78%), linear-gradient(0deg, var(--color-night), transparent 28%); }
.hero-content { padding-block: 54px 90px; }
.hero-frets { width: 100%; }

.eyebrow { font-family: var(--font-caps); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 20px; color: var(--color-gold); }
h1, h2, h3 { font-family: var(--font-pixel); font-weight: 400; }
h1 { font-size: clamp(76px, 10vw, 150px); line-height: 0.82; margin-bottom: 28px; }
.hero-intro { font-size: clamp(21px, 2.1vw, 27px); line-height: 1.35; max-width: 520px; }
.hero-description { max-width: 420px; margin-top: 16px; color: var(--color-dust); line-height: 1.55; font-size: 18px; }
.hero-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 28px; margin-top: 32px; }
.text-link { display: inline-flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 500; color: var(--color-bone); text-underline-offset: 5px; }
.text-link:hover { color: var(--color-gold); }
.watch-link { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 30px; font-size: 15px; color: var(--color-bone); text-decoration: none; }
.watch-link:hover { color: var(--color-gold); }
.play-icon { font-size: 11px; }
.watch-venue { color: var(--color-dust); }

.experience { padding-block: 96px 88px; }
h2 { font-size: clamp(40px, 5vw, 68px); line-height: 0.9; }
.section-heading > p:last-child { color: var(--color-dust); margin-top: 22px; font-size: 19px; }
.show-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 44px; margin-top: 56px; list-style: none; padding: 0; }
.show-steps li { border-top: var(--px) solid var(--color-tolex); padding-top: 24px; }
.step-number { display: inline-block; font-family: var(--font-pixel); color: var(--color-gold); font-size: 44px; line-height: 1; margin-bottom: 14px; }
h3 { font-size: 30px; line-height: 1; margin-bottom: 12px; }
.show-steps p, .backstage-copy p:not(.eyebrow), .booking > p:not(.eyebrow), .audience > p:not(.eyebrow) { color: var(--color-dust); font-size: 18px; line-height: 1.6; }

.backstage { display: grid; grid-template-columns: 1.1fr 1fr; align-items: center; gap: 72px; padding-block: 50px 110px; }
.share-artwork img { --edge: var(--color-tolex-hi); display: block; width: calc(100% - 2 * var(--px)); height: auto; aspect-ratio: 16 / 9; }
figcaption { font-size: 14px; line-height: 1.5; color: var(--color-dust); margin-top: 18px; }
.backstage h2 { margin-bottom: 24px; }
.backstage-copy p:not(.eyebrow) { margin-bottom: 20px; }

.join-section { border-top: var(--px) solid var(--color-tolex); padding-block: 90px; }
.join-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 100px; align-items: center; }
.booking > p:not(.eyebrow) { margin-block: 24px; max-width: 430px; }
.audience { --edge: var(--color-tolex-hi); padding: 36px; background: var(--color-tolex); scroll-margin-top: 24px; }
.audience h2 { font-size: clamp(36px, 3.6vw, 48px); margin-bottom: 16px; }
.audience .eyebrow { margin-bottom: 14px; }
.sign-in-buttons { display: grid; gap: 16px; margin-top: 26px; }
.sign-in-buttons .provider-button { width: calc(100% - 2 * var(--px)); justify-content: flex-start; text-transform: none; }
.provider-button img { width: 24px; height: 24px; object-fit: contain; flex-shrink: 0; }
.audience .privacy-note, .audience .login-status { font-size: 15px; margin-top: 18px; }
.login-error { color: var(--color-fret-2) !important; }
.privacy-note a { color: var(--color-bone); }

.show-footer { display: flex; justify-content: space-between; gap: 24px; padding-block: 34px; font-size: 15px; }
.show-footer p { font-family: var(--font-pixel); font-size: 22px; }
.show-footer p span { font-family: var(--font-sans); font-size: 15px; color: var(--color-dust); margin-left: 8px; }
.show-footer a { color: var(--color-bone); }
.show-footer div { display: flex; gap: 24px; color: var(--color-dust); }

@media (max-width: 1000px) {
  .wrap { width: calc(100% - 56px); }
  .byline { display: none; }
  .show-hero { min-height: 660px; }
  .hero-photo { width: 100%; object-position: 63% center; }
  .hero-shade { background: linear-gradient(90deg, color-mix(in srgb, var(--color-night) 93%, transparent), color-mix(in srgb, var(--color-night) 70%, transparent) 45%, color-mix(in srgb, var(--color-night) 30%, transparent)), linear-gradient(0deg, var(--color-night), transparent 35%); }
  .show-steps { gap: 26px; }
  .backstage { gap: 40px; }
  .join-grid { gap: 40px; }
  .audience { padding: 26px; }
}
@media (max-width: 700px) {
  .wrap { width: calc(100% - 32px); }
  .show-header { padding-block: 14px; gap: 16px; }
  .brand { width: 85px; }
  .show-hero { min-height: auto; padding-top: 170px; }
  .hero-photo { height: 400px; object-position: center 42%; }
  .hero-shade { background: linear-gradient(0deg, var(--color-night) 10%, var(--color-night) 30%, color-mix(in srgb, var(--color-night) 70%, transparent) 60%, transparent 100%); }
  .hero-content { padding-block: 40px 32px; }
  h1 { font-size: clamp(72px, 22vw, 110px); }
  .hero-description { font-size: 17px; }
  .hero-actions { gap: 22px; }
  .experience { padding-block: 60px; }
  .section-heading > p:last-child { font-size: 17px; line-height: 1.55; }
  .show-steps { grid-template-columns: 1fr; gap: 28px; margin-top: 32px; }
  .show-steps li { position: relative; padding-left: 48px; }
  .step-number { position: absolute; left: 0; top: 22px; font-size: 38px; }
  .show-steps p { font-size: 17px; }
  .backstage { grid-template-columns: 1fr; gap: 40px; padding-block: 20px 60px; }
  .join-section { padding-block: 56px; }
  .join-grid { grid-template-columns: 1fr; gap: 44px; }
  .audience { padding: 24px 20px; }
  .show-footer { flex-direction: column; }
  .show-footer div { gap: 22px; }
}
</style>
