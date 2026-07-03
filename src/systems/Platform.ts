/**
 * Environment/platform detection.
 *
 * The key case this exists for: iOS/WebKit gives cross-origin *embedded*
 * iframes (how itch.io serves HTML5 games) partitioned, ephemeral storage.
 * The localStorage probe succeeds, so saving appears to work, but the
 * partition is discarded on reload — progress silently vanishes. We detect
 * that case so BootScene can warn the player and offer to open the game as
 * its own top-level tab (where iOS persists storage normally).
 */

/** True when running inside an iframe (e.g. the itch.io embedded player). */
export function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin access to window.top can throw in some engines — if it
    // does, we are definitely embedded in a frame we don't control.
    return true;
  }
}

/** True on iOS/iPadOS across Safari, Chrome, Firefox (all WebKit under the hood). */
export function isIOS(): boolean {
  const ua = navigator.userAgent;
  if (/iP(hone|ad|od)/.test(ua)) return true;
  // iPadOS 13+ reports a desktop "Macintosh" UA; distinguish it by touch.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

/** Probe whether localStorage can be written at all (catches Safari Private Mode SecurityError). */
export function probeStorage(): boolean {
  try {
    const k = '__hb_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch (e) {
    console.warn('[Platform] localStorage unavailable:', e);
    return false;
  }
}

/**
 * Storage reliability for the current context:
 * - 'blocked'   — localStorage throws (e.g. Private Mode); nothing can persist.
 * - 'ephemeral' — writes succeed but won't survive a reload (iOS embedded iframe).
 * - 'ok'        — normal persistent storage.
 */
export function getStorageStatus(): 'ok' | 'blocked' | 'ephemeral' {
  if (!probeStorage()) return 'blocked';
  if (isIOS() && isEmbedded()) return 'ephemeral';
  return 'ok';
}
