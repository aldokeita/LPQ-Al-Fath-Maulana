// Keeps one unused attendance challenge ready, so a confirmation needs only the recognize call.
// One consumer at a time: both kiosk loops confirm one face at a time.
// The server expires a challenge after 45 s; a cached one is handed out only while younger than maxAgeMs.
export const CHALLENGE_MAX_AGE_MS = 30000;
// After a failed prefetch, wait before trying again so an offline kiosk does not hit the rate limit.
export const CHALLENGE_RETRY_MS = 5000;

export function createChallengeCache(request, { maxAgeMs = CHALLENGE_MAX_AGE_MS, retryMs = CHALLENGE_RETRY_MS, now = () => performance.now() } = {}) {
  let ready = null; let pending = null; let failedAt = -Infinity;
  const fresh = () => ready && now() - ready.issuedAt <= maxAgeMs;
  const refill = () => {
    if (!pending) {
      pending = Promise.resolve().then(request)
        .then(challenge => { ready = { challenge, issuedAt: now() }; return challenge; })
        .catch(error => { failedAt = now(); throw error; })
        .finally(() => { pending = null; });
    }
    return pending;
  };
  const take = () => { const { challenge } = ready; ready = null; return challenge; };
  return {
    // Background top-up; errors are held back until retryMs passes.
    prefetch() {
      if (fresh() || pending || now() - failedAt < retryMs) return;
      refill().catch(() => {});
    },
    // Resolves once a fresh challenge is waiting, without consuming it (readiness check on start).
    async ensure() { if (!fresh()) await refill(); },
    // Hands out the cached challenge, or fetches one now; either way the next one starts loading.
    async take() {
      if (!fresh()) { ready = null; await refill(); }
      const challenge = take();
      refill().catch(() => {});
      return challenge;
    },
  };
}
