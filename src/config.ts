import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
  CLIENT_ID: process.env.CLIENT_ID || '128490000000000000',
  GUILD_ID: process.env.GUILD_ID || '',
  ADMIN_CHANNEL_ID: process.env.ADMIN_CHANNEL_ID || process.env.STAFF_CHANNEL_ID || '',
  STAFF_CHANNEL_ID: process.env.STAFF_CHANNEL_ID || process.env.ADMIN_CHANNEL_ID || '',
  REQUESTS_CHANNEL_ID: process.env.REQUESTS_CHANNEL_ID || '',
  NOWPLAYING_CHANNEL_ID: process.env.NOWPLAYING_CHANNEL_ID || '',
  TMDB_API_KEY: process.env.TMDB_API_KEY || '',
  PORT: parseInt(process.env.PORT || '3001', 10),
  ZENOX_BASE_URL: process.env.ZENOX_BASE_URL || 'https://zenox.lol',
  NODE_ENV: process.env.NODE_ENV || 'development',
  DASHBOARD_SECRET: process.env.DASHBOARD_SECRET || 'zenox-cyber-secret-2026',
  PREFIX: process.env.BOT_PREFIX || '!',
};
