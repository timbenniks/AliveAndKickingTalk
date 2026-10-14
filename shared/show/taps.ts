// Tap rate limits for the crowd power meter and the encore vote.

// Phone side: at most `perSecond` taps go out in any rolling second.
export function createTapLimiter(perSecond: number) {
  const sent: number[] = []
  return {
    allow(now: number) {
      while (sent.length && now - sent[0]! >= 1000) sent.shift()
      if (sent.length >= perSecond) return false
      sent.push(now)
      return true
    },
  }
}

// Stage side: every tap is broadcast, so one phone (or a script) could flood
// the meter. Each uid counts for at most `perUidCap` taps per window.
export function createTapTally(windowMs: number, perUidCap: number) {
  const taps: Array<{ uid: string; at: number }> = []

  function prune(now: number) {
    while (taps.length && now - taps[0]!.at >= windowMs) taps.shift()
  }

  return {
    add(uid: string, now: number) {
      prune(now)
      if (taps.filter(tap => tap.uid === uid).length >= perUidCap) return false
      taps.push({ uid, at: now })
      return true
    },
    count(now: number) {
      prune(now)
      return taps.length
    },
  }
}
