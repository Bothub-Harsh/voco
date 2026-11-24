/**
 * Server-Wide Keep-Alive Manager with Daytime Schedule
 *
 * Defaults:
 *   - KEEPALIVE_START: "07:00"
 *   - KEEPALIVE_END: "23:00"
 *   - KEEPALIVE_TZ: "Asia/Kolkata"
 *   - KEEPALIVE_INTERVAL_MIN: 10
 */

export const DEFAULT_KEEPALIVE_CONFIG = {
  start: '07:00',
  end: '23:00',
  timeZone: 'Asia/Kolkata',
  intervalMinutes: 10,
};

let selfPingTimer = null;
let lastSelfPingAt = null;

export function parseTimeMinutes(str) {
  if (typeof str !== 'string') return null;
  const match = str.trim().match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function isValidTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function parseKeepAliveConfig(env = process.env) {
  let start = env.KEEPALIVE_START?.trim() || DEFAULT_KEEPALIVE_CONFIG.start;
  if (parseTimeMinutes(start) === null) {
    console.warn(`[Keep-Alive] Invalid KEEPALIVE_START '${env.KEEPALIVE_START}', falling back to '${DEFAULT_KEEPALIVE_CONFIG.start}'`);
    start = DEFAULT_KEEPALIVE_CONFIG.start;
  }

  let end = env.KEEPALIVE_END?.trim() || DEFAULT_KEEPALIVE_CONFIG.end;
  if (parseTimeMinutes(end) === null) {
    console.warn(`[Keep-Alive] Invalid KEEPALIVE_END '${env.KEEPALIVE_END}', falling back to '${DEFAULT_KEEPALIVE_CONFIG.end}'`);
    end = DEFAULT_KEEPALIVE_CONFIG.end;
  }

  let timeZone = env.KEEPALIVE_TZ?.trim() || DEFAULT_KEEPALIVE_CONFIG.timeZone;
  if (!isValidTimeZone(timeZone)) {
    console.warn(`[Keep-Alive] Invalid KEEPALIVE_TZ '${env.KEEPALIVE_TZ}', falling back to '${DEFAULT_KEEPALIVE_CONFIG.timeZone}'`);
    timeZone = DEFAULT_KEEPALIVE_CONFIG.timeZone;
  }

  let intervalMinutes = parseInt(env.KEEPALIVE_INTERVAL_MIN, 10);
  if (isNaN(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 60) {
    if (env.KEEPALIVE_INTERVAL_MIN) {
      console.warn(`[Keep-Alive] Invalid KEEPALIVE_INTERVAL_MIN '${env.KEEPALIVE_INTERVAL_MIN}', falling back to ${DEFAULT_KEEPALIVE_CONFIG.intervalMinutes}`);
    }
    intervalMinutes = DEFAULT_KEEPALIVE_CONFIG.intervalMinutes;
  }

  return { start, end, timeZone, intervalMinutes };
}

export function getTimeInTimezone(date, timeZone) {
  const d = date instanceof Date ? date : new Date(date);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(d).map((p) => [p.type, p.value]));
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(parts.minute, 10);
  const second = parseInt(parts.second, 10);
  return {
    hour,
    minute,
    second,
    totalMinutes: hour * 60 + minute,
    formatted: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

/**
 * Pure function: returns true if `now` is strictly inside [start, end)
 * Handles midnight-crossing window (e.g. 22:00 -> 06:00).
 */
export function isKeepAliveActive(now, config) {
  const cfg = config || parseKeepAliveConfig();
  const startMins = parseTimeMinutes(cfg.start);
  const endMins = parseTimeMinutes(cfg.end);
  const { totalMinutes } = getTimeInTimezone(now, cfg.timeZone);

  if (startMins === null || endMins === null) return true;

  if (startMins < endMins) {
    // Standard daytime window [start, end)
    return totalMinutes >= startMins && totalMinutes < endMins;
  } else if (startMins > endMins) {
    // Overnight / midnight-crossing window
    return totalMinutes >= startMins || totalMinutes < endMins;
  } else {
    // start === end -> 24/7 active
    return true;
  }
}

/**
 * Calculates the next window start timestamp (ISO string) when outside the active window.
 * Returns null if currently inside active window.
 */
export function getNextWindowStart(now, config) {
  const cfg = config || parseKeepAliveConfig();
  const active = isKeepAliveActive(now, cfg);
  if (active) return null;

  const [targetH, targetM] = cfg.start.split(':').map((v) => parseInt(v, 10));
  const d = now instanceof Date ? now : new Date(now);

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: cfg.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(dtf.formatToParts(d).map((p) => [p.type, p.value]));
  const year = parseInt(parts.year, 10);
  const month = parseInt(parts.month, 10);
  const day = parseInt(parts.day, 10);
  let curH = parseInt(parts.hour, 10);
  if (curH === 24) curH = 0;
  const curM = parseInt(parts.minute, 10);
  const curTotalMins = curH * 60 + curM;
  const targetTotalMins = targetH * 60 + targetM;

  let targetDate = new Date(Date.UTC(year, month - 1, day, targetH, targetM));
  // If we already passed today's start in the timezone, the next start is tomorrow
  if (curTotalMins >= targetTotalMins) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 1);
  }

  // Convert target local time in timezone back to exact UTC Date
  function getTimeZoneOffset(date, tz) {
    const tzDateStr = date.toLocaleString('en-US', { timeZone: tz });
    const localInTz = new Date(tzDateStr);
    return date.getTime() - localInTz.getTime();
  }

  const targetYear = targetDate.getUTCFullYear();
  const targetMonth = targetDate.getUTCMonth();
  const targetDay = targetDate.getUTCDate();

  const guessUtc = new Date(Date.UTC(targetYear, targetMonth, targetDay, targetH, targetM));
  const offsetMs = getTimeZoneOffset(guessUtc, cfg.timeZone);
  let actualUtc = new Date(guessUtc.getTime() + offsetMs);

  const checkParts = Object.fromEntries(dtf.formatToParts(actualUtc).map((p) => [p.type, p.value]));
  let chkH = parseInt(checkParts.hour, 10);
  if (chkH === 24) chkH = 0;
  const chkM = parseInt(checkParts.minute, 10);
  if (chkH !== targetH || chkM !== targetM) {
    const diffMins = chkH * 60 + chkM - targetTotalMins;
    actualUtc = new Date(actualUtc.getTime() - diffMins * 60000);
  }

  return actualUtc.toISOString();
}

/**
 * Returns structured keep-alive information for /health and /api/status.
 * @param {Date | string | number} [now]
 * @param {{ start: string, end: string, timeZone: string, intervalMinutes: number }} [config]
 */
export function getKeepAliveStatus(now = new Date(), config = undefined) {
  const cfg = config || parseKeepAliveConfig();
  const active = isKeepAliveActive(now, cfg);
  const nextStart = getNextWindowStart(now, cfg);

  return {
    enabledWindow: `${cfg.start}-${cfg.end}`,
    timezone: cfg.timeZone,
    activeNow: active,
    nextWindowStart: nextStart,
    lastSelfPingAt: lastSelfPingAt || null,
  };
}

export function getLastSelfPingAt() {
  return lastSelfPingAt;
}

export function setLastSelfPingAt(val) {
  lastSelfPingAt = val;
}

export function stopSelfKeepAlive() {
  if (selfPingTimer) {
    clearInterval(selfPingTimer);
    selfPingTimer = null;
  }
}

/**
 * Starts the self keep-alive timer.
 * Runs once every intervalMinutes (default 10 min).
 * Skips self-ping during night window.
 */
export function setupSelfKeepAlive(options = {}) {
  const config = options.config || parseKeepAliveConfig(options.env || process.env);
  const externalUrl =
    options.externalUrl ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.BASE_URL ||
    process.env.BACKEND_URL;

  // Ensure only ONE timer ever runs
  stopSelfKeepAlive();

  if (!externalUrl) {
    console.log('[Keep-Alive] No external URL configured for self-ping (local dev mode).');
    return null;
  }

  const intervalMs = (options.intervalMs != null) ? options.intervalMs : config.intervalMinutes * 60 * 1000;
  const targetHealthUrl = `${externalUrl.replace(/\/$/, '')}/health`;

  console.log(
    `[Keep-Alive] Daytime keep-alive initialized (${config.start}-${config.end} ${config.timeZone}, every ${config.intervalMinutes}m) targeting: ${targetHealthUrl}`
  );

  const fetchFn = options.fetch || globalThis.fetch;

  selfPingTimer = setInterval(async () => {
    try {
      const now = options.clock ? options.clock() : new Date();
      const active = isKeepAliveActive(now, config);

      if (!active) {
        const timeInfo = getTimeInTimezone(now, config.timeZone);
        console.log(`[Keep-Alive] keep-alive skipped: night (current time in ${config.timeZone}: ${timeInfo.formatted})`);
        return;
      }

      const isoNow = now.toISOString();
      const res = await fetchFn(targetHealthUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'Voco-Internal-Keepalive/1.0' },
      });

      lastSelfPingAt = isoNow;
      console.log(`[Keep-Alive] Ping sent at ${isoNow} -> HTTP ${res.status}`);
    } catch (err) {
      console.warn(`[Keep-Alive] Self-ping warning: ${err?.message || err}`);
    }
  }, intervalMs);

  if (selfPingTimer?.unref) {
    selfPingTimer.unref();
  }

  return selfPingTimer;
}
