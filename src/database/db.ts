import fs from 'fs';
import path from 'path';
import { ContentRequest, WatchParty, PanelDeployConfig, NodeStatus, ColorRoleDef } from '../types/index.js';
import { DEFAULT_SHOW_ROLES, DEFAULT_COLOR_ROLES } from '../utils/branding.js';
import { CONFIG } from '../config.js';

export interface BotChatMessage {
  id: string;
  channelId: string;
  channelName: string;
  content: string;
  isEmbed: boolean;
  embedTitle?: string;
  timestamp: number;
}

interface DatabaseSchema {
  requests: ContentRequest[];
  watchParties: WatchParty[];
  panels: Record<string, PanelDeployConfig>; // guildId -> config
  userColorRoles: Record<string, string>; // userId -> colorId
  userPingRoles: Record<string, string[]>; // userId -> pingId[]
  userShowRoles: Record<string, string[]>; // userId -> showId[]
  showCounts: Record<string, number>; // showId -> count
  systemNodes: NodeStatus[];
  colorRoles: ColorRoleDef[];
  botMessages: BotChatMessage[];
  adminChannelId?: string;
  requestsChannelId?: string;
  customPrefix?: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'zenox_db.json');

const INITIAL_NODES: NodeStatus[] = [
  {
    id: 'zenox-web-1',
    name: 'Zenox Official Web Streaming Platform',
    endpoint: 'https://zenox.lol',
    status: 'online',
    latencyMs: 22,
    uptime: 99.99,
    type: 'web',
    lastChecked: Date.now(),
  },
  {
    id: 'cdn-proxy-edge',
    name: 'High-Speed HLS Stream Edge',
    endpoint: 'stream.zenox.lol',
    status: 'online',
    latencyMs: 18,
    uptime: 100.0,
    type: 'cdn',
    lastChecked: Date.now(),
  },
  {
    id: 'zenox-us-east',
    name: 'Anti-ISP DNS Bypass Gateway',
    endpoint: 'https://proxy.zenox.lol',
    status: 'online',
    latencyMs: 48,
    uptime: 99.90,
    type: 'proxy',
    lastChecked: Date.now(),
  }
];

class DatabaseService {
  private data: DatabaseSchema;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_PATH)) {
      try {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        this.data = JSON.parse(raw);
        if (!this.data.colorRoles) this.data.colorRoles = [...DEFAULT_COLOR_ROLES];
        if (!this.data.botMessages) this.data.botMessages = [];
        if (!this.data.requests) this.data.requests = [];
      } catch (e) {
        console.error('Failed to parse existing zenox_db.json, initializing fresh DB.', e);
        this.data = this.getDefaults();
      }
    } else {
      this.data = this.getDefaults();
      this.save();
    }
  }

  private getDefaults(): DatabaseSchema {
    const showCounts: Record<string, number> = {};
    for (const show of DEFAULT_SHOW_ROLES) {
      showCounts[show.id] = show.memberCount;
    }

    return {
      requests: [],
      watchParties: [],
      panels: {},
      userColorRoles: {},
      userPingRoles: {},
      userShowRoles: {},
      showCounts,
      systemNodes: INITIAL_NODES,
      colorRoles: [...DEFAULT_COLOR_ROLES],
      botMessages: [],
    };
  }

  private save(): void {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving database to file:', err);
    }
  }

  // --- Requests ---
  public getRequests(): ContentRequest[] {
    return this.data.requests;
  }

  public getRequestById(id: string): ContentRequest | undefined {
    return this.data.requests.find(r => r.id === id);
  }

  public addRequest(req: ContentRequest): void {
    this.data.requests.unshift(req);
    this.save();
  }

  public updateRequestStatus(id: string, status: ContentRequest['status'], staffNotes?: string, reviewer?: string): ContentRequest | null {
    const req = this.data.requests.find(r => r.id === id);
    if (!req) return null;
    req.status = status;
    req.updatedAt = Date.now();
    if (staffNotes) req.staffNotes = staffNotes;
    if (reviewer) req.reviewedBy = reviewer;
    this.save();
    return req;
  }

  // --- Watch Parties ---
  public getWatchParties(): WatchParty[] {
    return this.data.watchParties;
  }

  public getWatchParty(id: string): WatchParty | undefined {
    return this.data.watchParties.find(w => w.id === id);
  }

  public addWatchParty(wp: WatchParty): void {
    this.data.watchParties.push(wp);
    this.save();
  }

  public toggleRSVP(watchPartyId: string, userId: string): { attending: boolean; total: number } | null {
    const wp = this.data.watchParties.find(w => w.id === watchPartyId);
    if (!wp) return null;

    const idx = wp.attendees.indexOf(userId);
    let attending = false;
    if (idx === -1) {
      wp.attendees.push(userId);
      attending = true;
    } else {
      wp.attendees.splice(idx, 1);
      attending = false;
    }
    this.save();
    return { attending, total: wp.attendees.length };
  }

  // --- Role Management State ---
  public setColorRole(userId: string, colorId: string): { previousColor: string | null; newColor: string } {
    const prev = this.data.userColorRoles[userId] || null;
    this.data.userColorRoles[userId] = colorId;
    this.save();
    return { previousColor: prev, newColor: colorId };
  }

  public getUserColorRole(userId: string): string | null {
    return this.data.userColorRoles[userId] || null;
  }

  public togglePingRole(userId: string, pingId: string): { added: boolean; allRoles: string[] } {
    if (!this.data.userPingRoles[userId]) {
      this.data.userPingRoles[userId] = [];
    }
    const roles = this.data.userPingRoles[userId];
    const idx = roles.indexOf(pingId);
    let added = false;
    if (idx === -1) {
      roles.push(pingId);
      added = true;
    } else {
      roles.splice(idx, 1);
      added = false;
    }
    this.save();
    return { added, allRoles: roles };
  }

  public getUserPingRoles(userId: string): string[] {
    return this.data.userPingRoles[userId] || [];
  }

  public toggleShowRole(userId: string, showId: string): { added: boolean; newCount: number } {
    if (!this.data.userShowRoles[userId]) {
      this.data.userShowRoles[userId] = [];
    }
    if (!this.data.showCounts[showId]) {
      this.data.showCounts[showId] = 100;
    }

    const roles = this.data.userShowRoles[userId];
    const idx = roles.indexOf(showId);
    let added = false;
    if (idx === -1) {
      roles.push(showId);
      this.data.showCounts[showId] += 1;
      added = true;
    } else {
      roles.splice(idx, 1);
      this.data.showCounts[showId] = Math.max(0, this.data.showCounts[showId] - 1);
      added = false;
    }
    this.save();
    return { added, newCount: this.data.showCounts[showId] };
  }

  public getShowCounts(): Record<string, number> {
    return this.data.showCounts;
  }

  // --- Panels ---
  public savePanelConfig(config: PanelDeployConfig): void {
    this.data.panels[config.guildId] = config;
    this.save();
  }

  public getPanelConfig(guildId: string): PanelDeployConfig | undefined {
    return this.data.panels[guildId];
  }

  // --- System Nodes ---
  public getSystemNodes(): NodeStatus[] {
    return this.data.systemNodes;
  }

  public updateNodeHealth(nodeId: string, status: NodeStatus['status'], latencyMs: number): void {
    const node = this.data.systemNodes.find(n => n.id === nodeId);
    if (node) {
      node.status = status;
      node.latencyMs = latencyMs;
      node.lastChecked = Date.now();
      this.save();
    }
  }

  // --- Custom Color Roles ---
  public getColorRoles(): ColorRoleDef[] {
    return this.data.colorRoles || DEFAULT_COLOR_ROLES;
  }

  public setColorRoles(roles: ColorRoleDef[]): void {
    this.data.colorRoles = roles;
    this.save();
  }

  // --- Bot Chat / Say Messages ---
  public getBotMessages(): BotChatMessage[] {
    return this.data.botMessages || [];
  }

  public addBotMessage(msg: BotChatMessage): void {
    if (!this.data.botMessages) this.data.botMessages = [];
    this.data.botMessages.unshift(msg);
    if (this.data.botMessages.length > 50) this.data.botMessages.pop();
    this.save();
  }

  // --- Admin Setup & Channels ---
  public getAdminChannelId(): string | undefined {
    return this.data.adminChannelId || CONFIG.ADMIN_CHANNEL_ID || CONFIG.STAFF_CHANNEL_ID || undefined;
  }

  public setAdminChannelId(channelId: string): void {
    this.data.adminChannelId = channelId;
    CONFIG.ADMIN_CHANNEL_ID = channelId;
    CONFIG.STAFF_CHANNEL_ID = channelId;
    this.save();
  }

  public getRequestsChannelId(): string | undefined {
    return this.data.requestsChannelId || CONFIG.REQUESTS_CHANNEL_ID || this.getAdminChannelId() || undefined;
  }

  public setRequestsChannelId(channelId: string): void {
    this.data.requestsChannelId = channelId;
    CONFIG.REQUESTS_CHANNEL_ID = channelId;
    this.save();
  }

  // --- Custom Prefix ---
  public getPrefix(): string {
    return this.data.customPrefix || CONFIG.PREFIX || '!';
  }

  public setPrefix(prefix: string): void {
    this.data.customPrefix = prefix;
    CONFIG.PREFIX = prefix;
    this.save();
  }
}

export const db = new DatabaseService();
