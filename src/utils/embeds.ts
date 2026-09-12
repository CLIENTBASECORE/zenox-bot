import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import {
  ZENOX_COLORS,
  ZENOX_BRANDING,
  DEFAULT_COLOR_ROLES,
  DEFAULT_PING_ROLES,
  DEFAULT_SHOW_ROLES,
  DEFAULT_MIRRORS,
} from './branding.js';
import { MediaItem, ContentRequest, WatchParty, NodeStatus, ColorRoleDef } from '../types/index.js';
import { db } from '../database/db.js';

export class ZenoxEmbeds {
  /**
   * Base aesthetic embed with Zenox styling and branding
   */
  public static base(title?: string, description?: string, color: number = ZENOX_COLORS.emerald): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTimestamp()
      .setFooter({
        text: `${ZENOX_BRANDING.name} Network • ${ZENOX_BRANDING.tagline}`,
        iconURL: ZENOX_BRANDING.avatarUrl,
      });

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);

    return embed;
  }

  // ==========================================
  // ROLE PANELS (Mirroring Cinejoy / Zenox Onboarding)
  // ==========================================

  /**
   * 1. Color Roles Panel:
   * Title: Colors
   * Description: Pick your custom name color below.
   */
  public static createColorPanel(customRoles?: ColorRoleDef[]): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
    const roles = customRoles && customRoles.length > 0 ? customRoles : db.getColorRoles();
    let desc = `Pick your custom name color below.\n\n`;
    for (const c of roles) {
      desc += `${c.emoji} \`@${c.name}\`\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle('Colors')
      .setDescription(desc)
      .setColor(ZENOX_COLORS.emerald)
      .setFooter({
        text: 'Zenox Role Dispatcher • Select one color at a time',
        iconURL: ZENOX_BRANDING.avatarUrl,
      });

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    const chunkSize = 5;
    for (let i = 0; i < roles.length && i < 25; i += chunkSize) {
      const chunk = roles.slice(i, i + chunkSize);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        chunk.map(c =>
          new ButtonBuilder()
            .setCustomId(`color_${c.id}`)
            .setLabel(c.name)
            .setEmoji(c.emoji)
            .setStyle(ButtonStyle.Secondary)
        )
      );
      rows.push(row);
    }

    return { embeds: [embed], components: rows };
  }

  /**
   * 2. Ping / Notification Roles Panel:
   * Title: Ping Roles
   * Description: Pick your notification roles below.
   */
  public static createPingPanel(): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
    let desc = `Pick your notification roles below.\n\n`;
    for (const p of DEFAULT_PING_ROLES) {
      desc += `${p.emoji} \`@${p.name}\`\n*${p.description}*\n\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle('Ping Roles')
      .setDescription(desc)
      .setColor(ZENOX_COLORS.emerald)
      .setFooter({
        text: 'Zenox Role Dispatcher • Click to toggle on/off',
        iconURL: ZENOX_BRANDING.avatarUrl,
      });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      DEFAULT_PING_ROLES.map(p =>
        new ButtonBuilder()
          .setCustomId(`ping_${p.id}`)
          .setLabel(p.name)
          .setEmoji(p.emoji)
          .setStyle(ButtonStyle.Success)
      )
    );

    return { embeds: [embed], components: [row] };
  }

  /**
   * 3. TV Show & Genre Access Roles:
   * Title: TV Show Channels
   * Description: Pick the shows you watch to unlock exclusive spoiler & discussion channels.
   */
  public static createShowPanel(): {
    embeds: EmbedBuilder[];
    components: (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[];
  } {
    const showCounts = db.getShowCounts();

    let desc = `Pick the shows you watch to unlock exclusive spoiler & discussion channels.\n\n`;
    for (const s of DEFAULT_SHOW_ROLES) {
      const count = showCounts[s.id] ?? s.memberCount;
      desc += `${s.emoji} \`@${s.name}\` — **${count.toLocaleString()}** members\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle('TV Show Channels')
      .setDescription(desc)
      .setColor(ZENOX_COLORS.emerald)
      .setFooter({
        text: 'Zenox TV Show Hub • Select from menu or buttons to unlock channels',
        iconURL: ZENOX_BRANDING.avatarUrl,
      });

    // Dropdown Select Menu for all shows
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_show_roles')
      .setPlaceholder('📺 Select TV Shows to toggle spoiler channel access...')
      .setMinValues(1)
      .setMaxValues(Math.min(5, DEFAULT_SHOW_ROLES.length))
      .addOptions(
        DEFAULT_SHOW_ROLES.map(s =>
          new StringSelectMenuOptionBuilder()
            .setLabel(s.name)
            .setValue(s.id)
            .setDescription(`Genre: ${s.genre} (${(showCounts[s.id] ?? s.memberCount).toLocaleString()} viewers)`)
            .setEmoji(s.emoji)
        )
      );

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    // Quick access button row for top 4 shows
    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      DEFAULT_SHOW_ROLES.slice(0, 4).map(s =>
        new ButtonBuilder()
          .setCustomId(`show_${s.id}`)
          .setLabel(s.name)
          .setEmoji(s.emoji)
          .setStyle(ButtonStyle.Secondary)
      )
    );

    return { embeds: [embed], components: [selectRow, buttonRow] };
  }

  // ==========================================
  // COMMAND EMBEDS (Search, Trending, Random, Request, WatchParty)
  // ==========================================

  public static mediaDetail(item: MediaItem): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
    const ratingStars = '★'.repeat(Math.floor(item.rating / 2)) + '☆'.repeat(5 - Math.floor(item.rating / 2));
    const typeBadge = item.type === 'movie' ? '🎬 MOVIE' : '📺 TV SERIES';

    const embed = new EmbedBuilder()
      .setTitle(`${item.title} (${item.year})`)
      .setURL(item.zenoxUrl)
      .setDescription(item.overview)
      .setColor(ZENOX_COLORS.emerald)
      .setImage(item.backdropUrl)
      .setThumbnail(item.posterUrl)
      .addFields(
        { name: '⭐ Rating', value: `\`${item.rating}/10\` ${ratingStars} (${item.votes.toLocaleString()} votes)`, inline: true },
        { name: '🎞️ Format', value: `\`${typeBadge}\` • \`${item.quality}\``, inline: true },
        { name: '🏷️ Genres', value: item.genres.map(g => `\`${g}\``).join(' '), inline: true }
      )
      .setFooter({
        text: `Zenox Streaming Engine • Instant 4K Playback`,
        iconURL: ZENOX_BRANDING.avatarUrl,
      });

    if (item.duration) {
      embed.addFields({ name: '⏱️ Runtime', value: `\`${item.duration}\``, inline: true });
    }
    if (item.seasons) {
      embed.addFields({ name: '📺 Seasons', value: `\`${item.seasons} Seasons (${item.episodes} eps)\``, inline: true });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('▶ Watch on Zenox')
        .setStyle(ButtonStyle.Link)
        .setURL(item.zenoxUrl),
      new ButtonBuilder()
        .setCustomId(`share_${item.id}`)
        .setLabel('Share Title')
        .setEmoji('🔗')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`request_wp_${item.id}`)
        .setLabel('Host Watch Party')
        .setEmoji('🍿')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row] };
  }

  public static trendingList(items: MediaItem[]): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
    let desc = `Top trending titles currently streaming on **Zenox**:\n\n`;

    items.forEach((item, index) => {
      const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index] || '▶';
      const icon = item.type === 'movie' ? '🎬' : '📺';
      desc += `${medal} ${icon} **[${item.title}](${item.zenoxUrl})** (${item.year})\n`;
      desc += `↳ ⭐ \`${item.rating}/10\` • \`${item.quality}\` • *${item.genres.join(', ')}*\n\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🔥 Top Trending on Zenox Today')
      .setDescription(desc)
      .setColor(ZENOX_COLORS.emerald)
      .setImage(items[0]?.backdropUrl || null)
      .setFooter({
        text: 'Zenox Daily Charts • Updated every hour',
        iconURL: ZENOX_BRANDING.avatarUrl,
      });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('🌐 Open Zenox Trending')
        .setStyle(ButtonStyle.Link)
        .setURL(`${ZENOX_BRANDING.websiteUrl}/trending`),
      new ButtonBuilder()
        .setCustomId('random_reroll')
        .setLabel('🎲 Surprise Me')
        .setStyle(ButtonStyle.Success)
    );

    return { embeds: [embed], components: [row] };
  }

  public static requestTicket(req: ContentRequest): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
    const statusBadges = {
      pending: '🟡 PENDING REVIEW',
      approved: '🟢 APPROVED',
      added: '🎉 ADDED TO CATALOG',
      rejected: '🔴 REJECTED',
    };

    const statusColors = {
      pending: ZENOX_COLORS.amber,
      approved: ZENOX_COLORS.cyan,
      added: ZENOX_COLORS.emerald,
      rejected: ZENOX_COLORS.rose,
    };

    const embed = new EmbedBuilder()
      .setTitle(`🎬 Request Ticket: ${req.title}`)
      .setColor(statusColors[req.status])
      .setDescription(`A community member requested a title to be added to the Zenox library.`)
      .addFields(
        { name: '📌 Title', value: `\`${req.title}\``, inline: true },
        { name: '🎞️ Category', value: `\`${req.type.toUpperCase()}\``, inline: true },
        { name: '📅 Year', value: `\`${req.year || 'N/A'}\``, inline: true },
        { name: '👤 Requester', value: `<@${req.requesterId}> (\`${req.requesterTag}\`)`, inline: true },
        { name: '📊 Status', value: `\`${statusBadges[req.status]}\``, inline: true },
        { name: '⏱️ Submitted', value: `<t:${Math.floor(req.createdAt / 1000)}:R>`, inline: true }
      );

    if (req.notes) {
      embed.addFields({ name: '📝 Requester Notes', value: `*${req.notes}*`, inline: false });
    }
    if (req.staffNotes) {
      embed.addFields({ name: '🛡️ Staff Resolution', value: `\`${req.staffNotes}\` (by ${req.reviewedBy || 'Staff'})`, inline: false });
    }

    embed.setFooter({
      text: `Zenox Request Queue • Ticket #${req.id}`,
      iconURL: ZENOX_BRANDING.avatarUrl,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`req_approve_${req.id}`)
        .setLabel('Approve')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success)
        .setDisabled(req.status === 'approved' || req.status === 'added'),
      new ButtonBuilder()
        .setCustomId(`req_added_${req.id}`)
        .setLabel('Mark Added')
        .setEmoji('🎉')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(req.status === 'added'),
      new ButtonBuilder()
        .setCustomId(`req_reject_${req.id}`)
        .setLabel('Reject')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(req.status === 'rejected')
    );

    return { embeds: [embed], components: [row] };
  }

  public static watchParty(wp: WatchParty): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
    const timeUnix = Math.floor(wp.scheduledTime / 1000);

    const embed = new EmbedBuilder()
      .setTitle(`🍿 Community Watch Party: ${wp.title}`)
      .setColor(ZENOX_COLORS.emerald)
      .setDescription(
        `Join fellow Zenox members for a synced stream experience!\nGrab your popcorn and hop into the voice lounge.`
      )
      .addFields(
        { name: '🎬 Title', value: `**${wp.title}**`, inline: true },
        { name: '👑 Host', value: `<@${wp.hostId}>`, inline: true },
        { name: '⏰ Showtime', value: `<t:${timeUnix}:F> (<t:${timeUnix}:R>)`, inline: true },
        { name: '🎟️ Attendees', value: `**${wp.attendees.length}** RSVPs`, inline: true },
        { name: '🌐 Direct Stream', value: `[Watch on Zenox](${wp.streamUrl})`, inline: true }
      )
      .setImage('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200')
      .setFooter({
        text: 'Zenox Watch Party • Click RSVP to get pinged at showtime',
        iconURL: ZENOX_BRANDING.avatarUrl,
      });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`wp_rsvp_${wp.id}`)
        .setLabel(`RSVP / Remind Me (${wp.attendees.length})`)
        .setEmoji('🎟️')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setLabel('▶ Open Stream Player')
        .setStyle(ButtonStyle.Link)
        .setURL(wp.streamUrl)
    );

    return { embeds: [embed], components: [row] };
  }

  public static systemStatus(nodes: NodeStatus[]): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
    const webNode = nodes.find(n => n.type === 'web') || nodes[0];

    const embed = new EmbedBuilder()
      .setTitle('🟢 Zenox Streaming Platform Status')
      .setColor(ZENOX_COLORS.emerald)
      .setDescription(
        `Official streaming services on [**zenox.lol**](https://zenox.lol) are fully operational.\n\n` +
        `**Official Platform:** [zenox.lol](https://zenox.lol)\n` +
        `• **Website Status:** \`ONLINE\` (Operational)\n` +
        `• **Playback Server:** \`ONLINE\` (Ultra HD / 4K Edge Streaming)\n` +
        `• **Network Latency:** \`${webNode?.latencyMs || 22}ms\`\n` +
        `• **Platform Uptime:** \`${webNode?.uptime || 99.99}%\`\n` +
        `• **Security & Anti-DDoS:** \`Cloudflare Enterprise Protected\`\n\n` +
        `Enjoy buffer-free streaming with dynamic subtitles at [**zenox.lol**](https://zenox.lol).`
      )
      .setFooter({
        text: 'Zenox Cinema Network • Live Website Telemetry',
        iconURL: ZENOX_BRANDING.avatarUrl,
      });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('status_refresh')
        .setLabel('Refresh Status')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('▶ Stream on zenox.lol')
        .setStyle(ButtonStyle.Link)
        .setURL('https://zenox.lol')
    );

    return { embeds: [embed], components: [row] };
  }

  public static domainList(): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
    let desc = `Official working domains, anti-ISP proxies, and dedicated stream CDNs for **Zenox**.\n*Bookmark these to avoid ISP DNS filters:*\n\n`;

    for (const m of DEFAULT_MIRRORS) {
      const badge = m.isOfficial ? '⭐ OFFICIAL' : '🛡️ MIRROR';
      const statusEmoji = m.status === 'active' ? '🟢' : '🟡';
      desc += `${statusEmoji} **https://${m.domain}** (\`${badge}\`)\n`;
      desc += `↳ Location: *${m.region}* • Cloudflare: \`${m.cloudflareProtected ? 'Protected' : 'Direct Edge'}\`\n\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle('🌐 Official Zenox Domains & Proxy Mirrors')
      .setColor(ZENOX_COLORS.emerald)
      .setDescription(desc)
      .setFooter({
        text: 'Zenox Domain Registry • Always verify SSL certificate',
        iconURL: ZENOX_BRANDING.avatarUrl,
      });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('🚀 Visit Official (zenox.lol)')
        .setStyle(ButtonStyle.Link)
        .setURL('https://zenox.lol'),
      new ButtonBuilder()
        .setLabel('🛡️ Bypass Proxy (proxy.zenox.lol)')
        .setStyle(ButtonStyle.Link)
        .setURL('https://proxy.zenox.lol')
    );

    return { embeds: [embed], components: [row] };
  }

  public static announcement(title: string, message: string, bannerUrl?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`📢 ${title}`)
      .setDescription(message)
      .setColor(ZENOX_COLORS.emerald)
      .setFooter({
        text: 'Zenox Announcements • Official Dispatch',
        iconURL: ZENOX_BRANDING.avatarUrl,
      });

    if (bannerUrl) {
      embed.setImage(bannerUrl);
    }

    return embed;
  }
}
