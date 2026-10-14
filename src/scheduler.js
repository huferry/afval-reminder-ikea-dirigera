'use strict';

const cron = require('node-cron');
const { loadConfig } = require('./config');
const { fetchSchedule } = require('./collectors/avalex');
const { activateNotification, dismissNotification, getActiveNotification } = require('./notification');

let schedulerStarted = false;

async function checkNotifications() {
  try {
    const config = await loadConfig();

    if (!config.postalCode || !config.houseNumber || !config.hubUrl || !config.token) {
      // Not fully configured yet, skip
      return;
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Calculate tomorrow's date
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const hours = now.getHours();
    const minutes = now.getMinutes();

    // At 08:00 on trash day: dismiss active notification (timeout)
    if (hours === 8 && minutes === 0) {
      const active = getActiveNotification();
      if (active && !active.testMode) {
        console.log('[Scheduler] Dismissing notification at 08:00 (trash day timeout)');
        await dismissNotification();
      }
    }

    // At 19:00 the day before trash day: activate notification
    if (hours === 19 && minutes === 0) {
      // Don't double-notify if already active (unless it's a different waste type)
      const active = getActiveNotification();
      if (active && !active.testMode) {
        console.log('[Scheduler] Notification already active, skipping');
        return;
      }

      // Fetch today's schedule to find tomorrow's trash
      let schedule;
      try {
        schedule = await fetchSchedule(config.postalCode, config.houseNumber);
      } catch (err) {
        console.error('[Scheduler] Failed to fetch schedule:', err.message);
        return;
      }

      const tomorrowEntries = schedule.filter((e) => e.date === tomorrowStr);
      if (tomorrowEntries.length === 0) {
        console.log('[Scheduler] No trash collection tomorrow, nothing to notify');
        return;
      }

      // If multiple types tomorrow, pick the first one (or pmd > papier > gft priority)
      const priority = ['pmd', 'papier', 'gft', 'gft', 'rest', 'other'];
      tomorrowEntries.sort((a, b) => {
        const ai = priority.indexOf(a.type);
        const bi = priority.indexOf(b.type);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });

      const entry = tomorrowEntries[0];
      console.log(`[Scheduler] Activating notification for ${entry.type} (${entry.label}) on ${tomorrowStr}`);
      try {
        await activateNotification(entry.type);
      } catch (err) {
        console.error('[Scheduler] Failed to activate notification:', err.message);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Unexpected error in checkNotifications:', err.message);
  }
}

function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Run every minute to check schedule
  cron.schedule('* * * * *', checkNotifications, {
    timezone: 'Europe/Amsterdam',
  });

  console.log('[Scheduler] Started — checking every minute (Europe/Amsterdam)');
}

module.exports = { startScheduler, checkNotifications };
