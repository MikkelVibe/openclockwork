import { beforeEach } from 'vitest';

// Existing UI fixtures explicitly exercise German; locale tests override this.
beforeEach(() => {
  window.localStorage.setItem('openclockwork.locale.v2', 'de');
});

Object.defineProperty(navigator, 'languages', {
  configurable: true,
  get: () => ['de-DE'],
});
