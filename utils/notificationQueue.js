const Job = require('../models/Job');
const { sendEmail } = require('./sendEmail');
const logger = require('./logger');

// Lazy-load Twilio client to prevent crash if credentials are unset
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (err) {
    logger.error(`Failed to initialize Twilio client: ${err.message}`);
  }
}

/**
 * Queue an email in the background
 */
async function queueEmail({ to, subject, templateName, replacements, scheduledFor = new Date() }) {
  try {
    const job = await Job.create({
      type: 'email',
      recipient: to,
      subject,
      templateName,
      payload: replacements,
      scheduledFor
    });
    logger.info(`Queued email job ${job._id} to ${to}`);
    return job;
  } catch (err) {
    logger.error(`Failed to queue email: ${err.message}`);
    throw err;
  }
}

/**
 * Queue an SMS in the background
 */
async function queueSMS({ to, body, scheduledFor = new Date() }) {
  try {
    const job = await Job.create({
      type: 'sms',
      recipient: to,
      payload: { body },
      scheduledFor
    });
    logger.info(`Queued SMS job ${job._id} to ${to}`);
    return job;
  } catch (err) {
    logger.error(`Failed to queue SMS: ${err.message}`);
    throw err;
  }
}

/**
 * Main queue processing sweep
 */
async function processQueue() {
  const now = new Date();
  
  // Find next pending jobs scheduled for now or earlier
  const jobs = await Job.find({
    status: { $in: ['pending', 'failed'] },
    attempts: { $lt: 3 },
    scheduledFor: { $lte: now }
  }).limit(10);

  if (jobs.length === 0) return;

  logger.info(`Notification queue: Processing ${jobs.length} outstanding job tasks...`);

  for (const job of jobs) {
    job.status = 'processing';
    job.attempts += 1;
    await job.save();

    try {
      if (job.type === 'email') {
        // Send email via Nodemailer utility
        await sendEmail({
          to: job.recipient,
          subject: job.subject,
          templateName: job.templateName,
          replacements: job.payload
        });
      } else if (job.type === 'sms') {
        // Send SMS via Twilio if active
        if (twilioClient) {
          await twilioClient.messages.create({
            body: job.payload.body,
            from: process.env.TWILIO_FROM_NUMBER || '+1234567890',
            to: job.recipient
          });
          logger.info(`Twilio SMS successfully dispatched to ${job.recipient}`);
        } else {
          // Log SMS to logs for localized/fallback systems
          logger.info(`[MOCK SMS] Outbox to ${job.recipient}: "${job.payload.body}"`);
        }
      }

      job.status = 'completed';
      await job.save();
      logger.info(`Notification job ${job._id} completed successfully.`);
    } catch (err) {
      logger.error(`Notification job ${job._id} attempt ${job.attempts} failed: ${err.message}`);
      
      job.errorLogs.push({
        attempt: job.attempts,
        error: err.message,
        runAt: new Date()
      });

      // Exponential backoff reschedule logic (1m, 4m, 9m)
      const nextRunTime = new Date();
      nextRunTime.setMinutes(nextRunTime.getMinutes() + Math.pow(job.attempts, 2));
      
      job.status = job.attempts >= job.maxAttempts ? 'failed' : 'pending';
      job.scheduledFor = nextRunTime;
      await job.save();
    }
  }
}

// Background scheduler interval (Sweeps every 30 seconds)
let intervalId = null;
function startQueueProcessor() {
  if (intervalId) return;
  
  logger.info('🚀 Notification Queue Processor initiated successfully.');
  intervalId = setInterval(() => {
    processQueue().catch(err => logger.error(`Queue sweep crash: ${err.message}`));
  }, 30000); // 30s
}

module.exports = {
  queueEmail,
  queueSMS,
  processQueue,
  startQueueProcessor
};
