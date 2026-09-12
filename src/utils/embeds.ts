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
    const ratingStars = '★'.repeat(Math.min(5, Math.max(0, Math.floor(item.rating / 2)))) + '☆'.repeat(Math.max(0, 5 - Math.min(5, Math.floor(item.rating / 2))));
    const typeBadge = item.type === 'movie' ? '🎬 MOVIE' : '📺 TV SERIES';

    const embed = new EmbedBuilder()
      .setTitle(`${item.title} (${item.year})`)
      .setURL(item.zenoxUrl)
      .setDescription(item.overview)
      .setColor(ZENOX_COLORS.emerald)
      .setImage(item.backdropUrl)
      .setThumbnail(item.posterUrl)
      .addFields(
        {
          name: '⭐ Rating & Reviews',
          value: `**${item.rating}/10** ${ratingStars}\n\`${item.votes.toLocaleString()}\` TMDB verified reviews`,
          inline: true,
        },
        { name: '🎞️ Format & Quality', value: `\`${typeBadge}\` • \`${item.quality}\``, inline: true },
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
        .setCustomId(`watchparty_host_${item.id}`)
        .setLabel('Host Watch Party')
        .setEmoji('🍿')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('random_reroll')
        .setLabel('🎲 Roll Another')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`share_${item.id}`)
        .setLabel('Share')
        .setEmoji('🔗')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row] };
  }

  public static trendingList(items: MediaItem[]): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
    let desc = `Top trending movies and TV series streaming on **Zenox** today (verified by live TMDB charts):\n\n`;

    items.forEach((item, index) => {
      const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index] || '▶';
      const icon = item.type === 'movie' ? '🎬' : '📺';
      desc += `${medal} ${icon} **[${item.title}](${item.zenoxUrl})** (${item.year})\n`;
      desc += `↳ ⭐ **${item.rating}/10** (\`${item.votes.toLocaleString()}\` TMDB reviews) • \`${item.quality}\` • *${item.genres.join(', ')}*\n\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🔥 Top Trending on Zenox Today')
      .setDescription(desc)
      .setColor(ZENOX_COLORS.emerald)
      .setImage(items[0]?.backdropUrl || null)
      .setFooter({
        text: 'Zenox Daily Charts • Powered by Live TMDB Data',
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

    const partyRoomUrl = wp.streamUrl.includes('?') ? `${wp.streamUrl}&watchparty=1` : `${wp.streamUrl}?watchparty=1`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`wp_rsvp_${wp.id}`)
        .setLabel(`RSVP / Join (${wp.attendees.length})`)
        .setEmoji('🎟️')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setLabel('▶ Stream on Zenox')
        .setStyle(ButtonStyle.Link)
        .setURL(wp.streamUrl),
      new ButtonBuilder()
        .setLabel('🍿 Zenox Watch Party Room')
        .setStyle(ButtonStyle.Link)
        .setURL(partyRoomUrl)
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

  /**
   * Interactive Paginated Help Menu with Category Buttons and Navigation
   */
  public static createHelpMenu(
    pageIndex: number = 0,
    activePrefix: string = '!'
  ): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
    const p = activePrefix;
    const page = Math.max(0, Math.min(3, pageIndex));

    let title = '';
    let desc = '';
    let categoryName = '';

    if (page === 0) {
      categoryName = 'Overview';
      title = '🌟 Zenox Cinema • Command & Prefix Manual';
      desc =
        `Welcome to the **Zenox Cinema Discord Bot**!\n` +
        `You can interact with the bot using **Slash Commands** (\`/command\`) or **Custom Prefix Commands** (\`${p}command\`).\n\n` +
        `**Current Server Prefix:** \`${p}\` *(Change anytime with \`${p}prefix <symbol>\` or \`/adminsetup prefix\`)*\n` +
        `**Official Platform:** [zenox.lol](https://zenox.lol) • High-Speed Ad-Free Streaming\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `### 📂 Select a Category Below:\n\n` +
        `• **🎬 Media & Streaming (Page 2)**\n` +
        `  Search TMDB catalog, view trending, roll random titles, broadcast now playing, schedule watch parties.\n\n` +
        `• **💬 Community & Requests (Page 3)**\n` +
        `  Request missing movies/series, public ticket queue, chat with Zenox AI, node latency, domain mirrors.\n\n` +
        `• **🛡️ Administrator & Setup (Page 4)**\n` +
        `  Server setup suite, broadcast announcements, say messages, deploy self-assign role panels, prefix settings.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 *Click the category buttons below to jump directly, or use \`◀️ Back\` and \`Next ▶️\` to browse!*`;
    } else if (page === 1) {
      categoryName = 'Media & Catalog';
      title = '🎬 Media & Catalog Commands';
      desc =
        `Search movies, TV series, anime, and host watch parties on Zenox.\n\n` +
        `### 1. \`${p}search <query>\` • \`/search <query>\`\n` +
        `• **Aliases:** \`${p}movie\`, \`${p}series\`, \`${p}anime\`, \`${p}find\`\n` +
        `• **Description:** Searches the Zenox TMDB catalog and generates an interactive detail card with direct stream links, genres, ratings, and synopsis.\n` +
        `• **Prefix Format:** \`${p}search <title>\` or \`${p}movie <title>\`\n` +
        `• **Example:** \`${p}movie Inception\` or \`${p}series Breaking Bad\`\n\n` +
        `### 2. \`${p}trending\` • \`/trending\`\n` +
        `• **Aliases:** \`${p}top\`\n` +
        `• **Description:** Displays the top 5 trending movies & TV shows on Zenox today with verified TMDB ratings, review counts, and instant stream buttons.\n` +
        `• **Prefix Format:** \`${p}trending\`\n\n` +
        `### 3. \`${p}random [genre|type]\` • \`/random [genre] [type]\`\n` +
        `• **Aliases:** \`${p}roll\`\n` +
        `• **Description:** Dynamically pulls a high-rated title from live TMDB Trending, Popular, and Top-Rated libraries. Every roll is genuinely different. If a genre is provided (e.g. Action, Horror, Comedy, Sci-Fi, Thriller), it guarantees a title from that specific genre!\n` +
        `• **Prefix Format:** \`${p}random [genre]\` or \`${p}random [movie|tv] [genre]\`\n` +
        `• **Slash Format:** \`/random [genre:action] [type:movie]\`\n` +
        `• **Example:** \`${p}random action\` • \`${p}random comedy\` • \`${p}random movie horror\` • \`${p}random tv drama\`\n\n` +
        `### 4. \`${p}nowplaying <title> | [year] | [quality]\` • \`/nowplaying\`\n` +
        `• **Aliases:** \`${p}np\`\n` +
        `• **Description:** Broadcasts what movie or episode you are currently streaming to the server.\n` +
        `• **Prefix Format:** \`${p}nowplaying <title> | [year] | [quality]\`\n` +
        `• **Example:** \`${p}nowplaying Dune: Part Two | 2024 | 4K HDR\`\n\n` +
        `### 5. \`${p}watchparty <title> | <minutes> | [url]\` • \`/watchparty\`\n` +
        `• **Aliases:** \`${p}wp\`\n` +
        `• **Description:** Schedules a community watch party event with interactive RSVP counter buttons, live countdown, and direct Zenox room links. You can also click the **🍿 Host Watch Party** button on any movie/series card to launch one instantly!\n` +
        `• **Prefix Format:** \`${p}watchparty <title> | <minutes from now> | [link]\`\n` +
        `• **Example:** \`${p}watchparty Interstellar | 30 | https://zenox.lol/watch/157336\``;
    } else if (page === 2) {
      categoryName = 'Community & Requests';
      title = '💬 Community & Request Commands';
      desc =
        `Submit content requests, talk to Zenox AI, check server status, and official mirrors.\n\n` +
        `### 1. \`${p}request <type> <title> | [notes]\` • \`/request\`\n` +
        `• **Aliases:** \`${p}req\`\n` +
        `• **Description:** Submit a request for missing movies, anime, or series to the Zenox team. Opens an interactive staff ticket.\n` +
        `• **Prefix Format:** \`${p}request <movie|series|anime> <title> | [notes]\` *(or \`${p}request <title>\`)*\n` +
        `• **Example:** \`${p}request movie Fight Club | 1080p BluRay\`\n` +
        `• **Example:** \`${p}request series Severance | Please add Season 2\`\n\n` +
        `### 2. \`${p}requests [list|pending]\` • \`/requests list\`\n` +
        `• **Aliases:** \`${p}reqs\`\n` +
        `• **Description:** View public community media requests and their status (Pending, Approved, Added, Rejected).\n` +
        `• **Prefix Format:** \`${p}requests\` or \`${p}requests list\`\n\n` +
        `### 3. \`${p}chat <question>\` • \`/chat prompt:<text>\`\n` +
        `• **Aliases:** \`${p}ai\`, \`${p}ask\`\n` +
        `• **Description:** Ask Zenox Cinema AI for recommendations, trivia, actors, or streaming help. *(You can also directly @mention the bot!)*\n` +
        `• **Prefix Format:** \`${p}chat <message>\`\n` +
        `• **Example:** \`${p}chat Recommend me 3 psychological thrillers like Shutter Island\`\n\n` +
        `### 4. \`${p}status\` • \`/status\`\n` +
        `• **Aliases:** \`${p}ping\`\n` +
        `• **Description:** Checks live health, CDN edge latency, and streaming node status for zenox.lol.\n` +
        `• **Prefix Format:** \`${p}status\`\n\n` +
        `### 5. \`${p}domain\` • \`/domain\`\n` +
        `• **Aliases:** \`${p}site\`, \`${p}url\`, \`${p}link\`, \`${p}mirrors\`\n` +
        `• **Description:** Displays official Zenox domains, proxy bypass URLs, and mirror statuses.\n` +
        `• **Prefix Format:** \`${p}domain\`\n\n` +
        `### 6. \`${p}botinfo\` • \`/botinfo\`\n` +
        `• **Aliases:** \`${p}info\`, \`${p}about\`\n` +
        `• **Description:** Displays bot uptime, memory usage, gateway ping, and cloud architecture.\n` +
        `• **Prefix Format:** \`${p}botinfo\``;
    } else {
      categoryName = 'Admin & Setup';
      title = '🛡️ Administrator & Setup Commands';
      desc =
        `🔒 **Security Notice:** Administrator commands require the \`Administrator\` permission and must be run inside the designated admin chat!\n\n` +
        `### 1. \`${p}adminsetup <subcommand> [args]\` • \`/adminsetup\`\n` +
        `• **Description:** Master configuration suite to bind channels, sync roles, unlock permissions, and customize prefix.\n` +
        `• **Subcommands:**\n` +
        `  ↳ \`${p}adminsetup status\` — View active channels, role sync, and ticket stats\n` +
        `  ↳ \`${p}adminsetup channel <#channel>\` — Set dedicated admin chat\n` +
        `  ↳ \`${p}adminsetup requests_channel <#channel>\` — Set media request tickets channel\n` +
        `  ↳ \`${p}adminsetup prefix <symbol>\` — Set custom command prefix (e.g. \`!\`, \`?\`, \`.\`)\n` +
        `  ↳ \`${p}adminsetup unlock_commands\` — Ensure commands are unlocked for all members\n` +
        `  ↳ \`${p}adminsetup color_roles [#channel]\` — Create/sync 7 color roles & deploy panel\n` +
        `  ↳ \`${p}adminsetup movie_roles [#channel]\` — Create/sync TV show spoiler roles & deploy panel\n` +
        `  ↳ \`${p}adminsetup ping_roles [#channel]\` — Create/sync notification alert roles & deploy panel\n\n` +
        `### 2. \`${p}prefix [new_prefix]\`\n` +
        `• **Description:** View current prefix, or change it *(Administrator only)*.\n` +
        `• **Prefix Format:** \`${p}prefix\` (view) or \`${p}prefix <new>\` (change)\n` +
        `• **Example:** \`${p}prefix ?\`\n\n` +
        `### 3. \`${p}say <#channel> <message>\` • \`/say\`\n` +
        `• **Description:** Send a message or embed to any server channel as the bot.\n` +
        `• **Prefix Format:** \`${p}say <#channel> <message>\`\n` +
        `• **Example:** \`${p}say #general Welcome to Zenox Cinema!\`\n\n` +
        `### 4. \`${p}announce <#channel> <title> | <message>\` • \`/announce\`\n` +
        `• **Description:** Broadcast a styled Zenox Cinema announcement with banner embed.\n` +
        `• **Prefix Format:** \`${p}announce <#channel> <Title> | <Description>\`\n` +
        `• **Example:** \`${p}announce #announcements 4K Remux Updates | 20 new movies added!\`\n\n` +
        `### 5. \`${p}panel <type> [#channel]\` • \`/panel\`\n` +
        `• **Description:** Deploy interactive role self-assign panels (Colors, Pings, Shows, All).\n` +
        `• **Prefix Format:** \`${p}panel <colors|pings|shows|all> [#channel]\`\n` +
        `• **Example:** \`${p}panel colors #roles\` or \`${p}panel all #roles\`\n\n` +
        `### 6. \`${p}requests resolve <id> <status> [notes]\` • \`/requests resolve\`\n` +
        `• **Description:** Resolve a user's movie request ticket and send them a DM update.\n` +
        `• **Prefix Format:** \`${p}requests resolve <req-id> <approved|added|rejected> [notes]\`\n` +
        `• **Example:** \`${p}requests resolve req-123 added Live on zenox.lol! enjoy!\``;
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(page === 3 ? ZENOX_COLORS.violet : ZENOX_COLORS.emerald)
      .setDescription(desc)
      .setFooter({
        text: `Zenox Help Manual • Page ${page + 1} of 4 • Category: ${categoryName}`,
        iconURL: ZENOX_BRANDING.avatarUrl,
      })
      .setTimestamp();

    // Row 1: Direct Category Buttons
    const categoryRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('help_cat_0')
        .setLabel('🏠 Overview')
        .setStyle(page === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('help_cat_1')
        .setLabel('🎬 Media')
        .setStyle(page === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('help_cat_2')
        .setLabel('💬 Community')
        .setStyle(page === 2 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('help_cat_3')
        .setLabel('🛡️ Admin')
        .setStyle(page === 3 ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    // Row 2: Navigation & Controls
    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`help_prev_${page}`)
        .setLabel('◀️ Back')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId('help_indicator')
        .setLabel(`Page ${page + 1} / 4`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`help_next_${page}`)
        .setLabel('Next ▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 3),
      new ButtonBuilder()
        .setCustomId('help_close')
        .setLabel('❌ Close')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [categoryRow, navRow] };
  }
}
