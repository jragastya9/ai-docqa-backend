import cron from 'node-cron';
import {
  runDailyJobs,
  runWeeklyJobs,
} from '../services/marketingService.js';

export function startScheduler() {
  // Daily jobs — every day at 9 AM
  cron.schedule(
    '0 9 * * *',
    async () => {
      try {
        await runDailyJobs();
      } catch (err) {
        console.error('Daily jobs error:', err);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );

  // Weekly digest — Sunday at 10 AM
  cron.schedule(
    '0 10 * * 0',
    async () => {
      try {
        await runWeeklyJobs();
      } catch (err) {
        console.error('Weekly jobs error:', err);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );

  console.log('⏰ Scheduler started (daily 9 AM IST, weekly Sun 10 AM IST)');
}
