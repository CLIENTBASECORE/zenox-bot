import { ColorRoleDef, PingRoleDef, ShowRoleDef, DomainMirror } from '../types/index.js';

export const ZENOX_COLORS = {
  emerald: 0x22c55e,
  mint: 0x10b981,
  obsidian: 0x080808,
  charcoal: 0x0f0f11,
  slate: 0x141417,
  card: 0x18181b,
  cyan: 0x06b6d4,
  violet: 0xa855f7,
  amber: 0xf59e0b,
  rose: 0xef4444,
};

export const ZENOX_BRANDING = {
  name: 'Zenox',
  wordmark: 'zenox.',
  tagline: 'Stream Movies & Series',
  avatarUrl: 'https://zenox.lol/zenox-icon.png',
  bannerUrl: 'https://zenox.lol/og-image.jpg',
  websiteUrl: 'https://zenox.lol',
  supportDiscord: 'https://discord.gg/mYvhW9FNC9',
  version: '2.4.0-PRO',
};

export const DEFAULT_COLOR_ROLES: ColorRoleDef[] = [
  { id: 'pink', name: 'Pink', emoji: '1️⃣', hex: '#ec4899' },
  { id: 'purple', name: 'Purple', emoji: '2️⃣', hex: '#a855f7' },
  { id: 'blue', name: 'Blue', emoji: '3️⃣', hex: '#3b82f6' },
  { id: 'green', name: 'Green', emoji: '4️⃣', hex: '#22c55e' },
  { id: 'orange', name: 'Orange', emoji: '5️⃣', hex: '#f97316' },
  { id: 'yellow', name: 'Yellow', emoji: '6️⃣', hex: '#eab308' },
  { id: 'red', name: 'Red', emoji: '7️⃣', hex: '#ef4444' },
];

export const DEFAULT_PING_ROLES: PingRoleDef[] = [
  {
    id: 'content_update',
    name: 'Content Update',
    description: 'New movies, 4K remuxes & trending series released on zenox.lol',
    emoji: '1️⃣',
  },
  {
    id: 'movie_night',
    name: 'Movie Night',
    description: 'Community watch parties, voice room streams & polls',
    emoji: '2️⃣',
  },
  {
    id: 'site_updates',
    name: 'Site Updates',
    description: 'Domain mirrors, player fixes, scraper health & alerts',
    emoji: '3️⃣',
  },
];

export const DEFAULT_SHOW_ROLES: ShowRoleDef[] = [
  { id: 'love_island', name: 'Love Island', emoji: '🏝️', genre: 'Reality TV', memberCount: 1420 },
  { id: 'the_mentalist', name: 'The Mentalist', emoji: '🧠', genre: 'Mystery / Crime', memberCount: 890 },
  { id: 'the_rookie', name: 'The Rookie', emoji: '🚓', genre: 'Police Procedural', memberCount: 1150 },
  { id: 'prison_break', name: 'Prison Break', emoji: '⛓️', genre: 'Action / Thriller', memberCount: 1730 },
  { id: 'rick_and_morty', name: 'Rick and Morty', emoji: '🧪', genre: 'Sci-Fi / Animation', memberCount: 2310 },
  { id: 'reacher', name: 'Reacher', emoji: '👊', genre: 'Crime / Action', memberCount: 1640 },
  { id: 'stranger_things', name: 'Stranger Things', emoji: '🚲', genre: 'Sci-Fi / Horror', memberCount: 2840 },
  { id: 'the_boys', name: 'The Boys', emoji: '⚡', genre: 'Superhero / Satire', memberCount: 1980 },
];

export const DEFAULT_MIRRORS: DomainMirror[] = [
  { domain: 'zenox.lol', region: 'Global Official Site', status: 'active', isOfficial: true, cloudflareProtected: true },
  { domain: 'stream.zenox.lol', region: 'Ultra-Fast HLS Playback Server', status: 'active', isOfficial: true, cloudflareProtected: true },
  { domain: 'proxy.zenox.lol', region: 'Anti-ISP DNS Bypass Gateway', status: 'active', isOfficial: true, cloudflareProtected: true },
  { domain: 'cdn.zenox.lol', region: 'Multi-CDN 4K Edge Node', status: 'active', isOfficial: true, cloudflareProtected: true },
  { domain: 'mirror.zenox.lol', region: 'Emergency Failover Mirror', status: 'backup', isOfficial: true, cloudflareProtected: true },
];
