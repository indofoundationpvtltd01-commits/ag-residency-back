const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const EmailLog = require('../models/EmailLog');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const loadTemplate = (templateName, replacements = {}) => {
  const templatePath = path.join(__dirname, '../templates', templateName);
  let html = fs.readFileSync(templatePath, 'utf-8');
  Object.entries(replacements).forEach(([key, value]) => {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });
  return html;
};

const sendEmail = async ({ to, subject, templateName, replacements, html: rawHtml }) => {
  try {
    const html = rawHtml || loadTemplate(templateName, replacements);
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'AG Residency <noreply@agresidency.com>',
      to,
      subject,
      html,
    });
    
    // Log success
    await EmailLog.create({
      to,
      subject,
      template: templateName,
      status: 'sent',
      metadata: { messageId: info.messageId }
    });

    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    // Log failure
    await EmailLog.create({
      to,
      subject,
      template: templateName,
      status: 'failed',
      error: error.message
    }).catch(e => logger.error(`Failed to log email error: ${e.message}`));

    logger.error(`Email send failed to ${to}: ${error.message}`);
    throw error;
  }
};

module.exports = { sendEmail };
