// config/validate.js
require('dotenv').config();

const required = ['BOT_TOKEN', 'ADMIN_CHAT_ID'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error(`❌ Missing env variables: ${missing.join(', ')}`);
  console.error('📝 Check your Render.com environment variables');
  process.exit(1);
}

const ADMIN_CHAT_ID = parseInt(process.env.ADMIN_CHAT_ID, 10);
if (isNaN(ADMIN_CHAT_ID)) {
  console.error('❌ ADMIN_CHAT_ID must be a valid number');
  process.exit(1);
}

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  ADMIN_CHAT_ID
};