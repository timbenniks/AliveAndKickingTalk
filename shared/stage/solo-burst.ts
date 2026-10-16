// A playful measure of detected attack density, not a musical solo classifier.
// Group a strum's voices before counting, independent of animation frame rate.
export class SoloBurst {
  private group: { at: number; pitch: number; chord: boolean } | null = null;
  private attacks: number[] = [];
  private previous = 0;
  private level = 0;

  reset() {
    this.group = null;
    this.attacks = [];
    this.previous = 0;
    this.level = 0;
  }

  attack(pitch: number, now: number) {
    this.finishGroup(now);
    if (this.group) {
      if (pitch !== this.group.pitch) this.group.chord = true;
    } else this.group = { at: now, pitch, chord: false };
  }

  private finishGroup(now: number) {
    if (!this.group || now - this.group.at < 0.055) return;
    if (this.group.chord) this.attacks = [];
    else {
      const last = this.attacks.at(-1);
      if (last !== undefined && this.group.at - last > 0.28) this.attacks = [];
      this.attacks.push(this.group.at);
      if (this.attacks.length > 24) this.attacks.shift();
    }
    this.group = null;
  }

  sample(now: number) {
    this.finishGroup(now);
    this.attacks = this.attacks.filter(at => now - at <= 1.2);
    const first = this.attacks[0] ?? now;
    const last = this.attacks.at(-1) ?? -10;
    const span = last - first;
    const rate = this.attacks.length >= 6 && span >= 0.35 && now - last <= 0.3
      ? (this.attacks.length - 1) / span : 0;
    const target = rate >= 5 ? Math.min(1, 0.45 + (rate - 5) / 7) : 0;
    const delta = this.previous ? Math.max(0, now - this.previous) : 1 / 60;
    this.previous = now;
    this.level += (target - this.level) * (1 - Math.exp(-delta / (target > this.level ? 0.12 : 0.55)));
    if (this.level < 0.01) this.level = 0;
    return { level: this.level, rate: Math.round(rate * 10) / 10 };
  }
}
