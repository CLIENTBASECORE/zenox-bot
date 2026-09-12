export interface ColorRoleDef {
  id: string;
  name: string;
  emoji: string;
  hex: string;
  discordRoleId?: string;
}

export interface PingRoleDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
  discordRoleId?: string;
}

export interface ShowRoleDef {
  id: string;
  name: string;
  emoji: string;
  genre: string;
  memberCount: number;
  discordRoleId?: string;
  channelId?: string;
}

export type RequestStatus = 'pending' | 'approved' | 'added' | 'rejected';

export interface ContentRequest {
  id: string;
  title: string;
  type: 'movie' | 'series' | 'anime';
  year?: string;
  requesterId: string;
  requesterTag: string;
  requesterAvatar?: string;
  notes?: string;
  status: RequestStatus;
  createdAt: number;
  updatedAt: number;
  staffNotes?: string;
  reviewedBy?: string;
  messageId?: string;
  channelId?: string;
}

export interface WatchParty {
  id: string;
  title: string;
  type: 'movie' | 'series';
  streamUrl: string;
  scheduledTime: number;
  hostId: string;
  hostTag: string;
  attendees: string[]; // Discord User IDs
  channelId: string;
  messageId: string;
}

export interface NodeStatus {
  id: string;
  name: string;
  endpoint: string;
  status: 'online' | 'degraded' | 'offline';
  latencyMs: number;
  uptime: number; // percentage
  type: 'web' | 'proxy' | 'scraper' | 'cdn' | 'database';
  lastChecked: number;
}

export interface DomainMirror {
  domain: string;
  region: string;
  status: 'active' | 'backup' | 'maintenance';
  isOfficial: boolean;
  cloudflareProtected: boolean;
}

export interface PanelDeployConfig {
  guildId: string;
  channelId: string;
  panelType: 'colors' | 'pings' | 'shows' | 'all';
  messageIds: {
    colors?: string;
    pings?: string;
    shows?: string;
  };
  lastDeployed: number;
}

export interface MediaItem {
  id: string;
  title: string;
  type: 'movie' | 'tv';
  year: number;
  rating: number; // 0 - 10
  votes: number;
  posterUrl: string;
  backdropUrl: string;
  overview: string;
  genres: string[];
  duration?: string;
  seasons?: number;
  episodes?: number;
  zenoxUrl: string;
  quality: '4K HDR' | '1080p Ultra' | 'HD';
}
