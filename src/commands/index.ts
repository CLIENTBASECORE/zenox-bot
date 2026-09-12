import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  MessageFlags,
  EmbedBuilder,
} from 'discord.js';
import { CatalogService } from '../services/catalog.js';
import { StatusService } from '../services/status.js';
import { AiChatService } from '../services/aiChat.js';
import { ZenoxEmbeds } from '../utils/embeds.js';
import { db } from '../database/db.js';
import { ContentRequest, WatchParty, ColorRoleDef } from '../types/index.js';
import { CONFIG } from '../config.js';
import { DEFAULT_SHOW_ROLES, DEFAULT_PING_ROLES, ZENOX_COLORS, ZENOX_BRANDING } from '../utils/branding.js';

export interface Command {
  data: any;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

/**
 * Strict verification helper for Administrator-only commands:
 * 1. Checks if member has Administrator permission.
 * 2. Checks if the command is being executed inside the designated admin channel ID.
 */
export async function ensureAdminContext(
  interaction: ChatInputCommandInteraction,
  options?: { allowConfigChannel?: boolean }
): Promise<boolean> {
  // 1. Check Administrator permission
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ **Access Denied**: You must have the `Administrator` permission in this Discord server to use this command.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  // 2. Check Admin Channel restriction
  const adminChanId = db.getAdminChannelId();
  if (adminChanId) {
    const channelExists = interaction.guild?.channels.cache.has(adminChanId);
    if (channelExists && interaction.channelId !== adminChanId) {
      await interaction.reply({
        content: `🔒 **Admin Channel Restricted**: Administrator commands can only be performed in the designated admin chat: <#${adminChanId}>.`,
        flags: MessageFlags.Ephemeral,
      });
      return false;
    }
  } else {
    // If admin channel has not been designated yet:
    if (!options?.allowConfigChannel) {
      await interaction.reply({
        content: `⚠️ **Admin Chat Required**: Please designate an admin channel first using \`/adminsetup channel [admin_channel]\`, or set \`ADMIN_CHANNEL_ID\` in your \`.env\` file.`,
        flags: MessageFlags.Ephemeral,
      });
      return false;
    }
  }

  return true;
}

// 1. /search [query]
export const searchCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search the Zenox TMDB catalog for movies and TV shows')
    .addStringOption(opt =>
      opt.setName('query').setDescription('Movie or TV show title').setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const query = interaction.options.getString('query', true);
    const results = await CatalogService.search(query);

    if (results.length === 0) {
      await interaction.editReply({
        content: `❌ No matching titles found on Zenox for \`${query}\`. You can use \`/request\` to ask our team to add it!`,
      });
      return;
    }

    const payload = ZenoxEmbeds.mediaDetail(results[0]);
    await interaction.editReply(payload);
  },
};

// 2. /trending
export const trendingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('trending')
    .setDescription('View the top 5 trending movies & TV shows on Zenox today'),
  async execute(interaction) {
    await interaction.deferReply();
    const trending = CatalogService.getTrending();
    const payload = ZenoxEmbeds.trendingList(trending);
    await interaction.editReply(payload);
  },
};

// 3. /random [type] [genre]
export const randomCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('random')
    .setDescription('Pick a high-rated random title to watch on Zenox')
    .addStringOption(opt =>
      opt
        .setName('type')
        .setDescription('Filter by movie or series')
        .setRequired(false)
        .addChoices(
          { name: '🎬 Movie', value: 'movie' },
          { name: '📺 TV Series', value: 'tv' }
        )
    )
    .addStringOption(opt =>
      opt.setName('genre').setDescription('Filter by genre (e.g. Sci-Fi, Action, Animation)').setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const type = interaction.options.getString('type') as 'movie' | 'tv' | null;
    const genre = interaction.options.getString('genre') || undefined;

    const item = CatalogService.getRandom(type || undefined, genre);
    const payload = ZenoxEmbeds.mediaDetail(item);
    await interaction.editReply(payload);
  },
};

// 4. /request [title] [type] [notes]
export const requestCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('request')
    .setDescription('Request a missing movie or TV show season to be added to Zenox')
    .addStringOption(opt =>
      opt.setName('title').setDescription('Title of the movie, anime, or series').setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('type')
        .setDescription('Category')
        .setRequired(true)
        .addChoices(
          { name: '🎬 Movie', value: 'movie' },
          { name: '📺 TV Series', value: 'series' },
          { name: '⛩️ Anime', value: 'anime' }
        )
    )
    .addStringOption(opt =>
      opt.setName('year').setDescription('Release year (e.g. 2024)').setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('notes').setDescription('Specific notes (e.g. 4K remux, specific audio dub)').setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const title = interaction.options.getString('title', true);
    const type = interaction.options.getString('type', true) as 'movie' | 'series' | 'anime';
    const year = interaction.options.getString('year') || undefined;
    const notes = interaction.options.getString('notes') || undefined;

    const newRequest: ContentRequest = {
      id: `req-${Date.now().toString(36)}`,
      title,
      type,
      year,
      requesterId: interaction.user.id,
      requesterTag: interaction.user.tag,
      requesterAvatar: interaction.user.displayAvatarURL(),
      notes,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    db.addRequest(newRequest);

    // Forward interactive ticket with approve/added/reject buttons to configured requests or admin channel
    const targetChannelId = db.getRequestsChannelId() || db.getAdminChannelId();
    let channelTarget: TextChannel | null = null;
    if (targetChannelId && interaction.guild) {
      channelTarget = (interaction.guild.channels.cache.get(targetChannelId) as TextChannel) || null;
      if (!channelTarget) {
        try {
          channelTarget = (await interaction.guild.channels.fetch(targetChannelId)) as TextChannel;
        } catch {}
      }
    }

    if (channelTarget) {
      try {
        const ticketPayload = ZenoxEmbeds.requestTicket(newRequest);
        const msg = await channelTarget.send(ticketPayload);
        newRequest.messageId = msg.id;
        newRequest.channelId = channelTarget.id;
      } catch (err) {
        console.warn('Could not dispatch request ticket to staff channel:', err);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎬 New Content Request: ${title}`)
      .setColor(ZENOX_COLORS.emerald)
      .setDescription(
        `<@${interaction.user.id}> submitted a request to add **${title}** to the Zenox catalog!\n\n` +
        `• **Title**: \`${title}\`\n` +
        `• **Category**: \`${type.toUpperCase()}\`${year ? ` (${year})` : ''}\n` +
        (notes ? `• **Notes**: *${notes}*\n` : '') +
        `• **Status**: \`🟡 PENDING REVIEW\`\n` +
        `• **Ticket ID**: \`#${newRequest.id}\``
      )
      .setFooter({ text: 'Zenox Media Queue • Streaming on zenox.lol', iconURL: ZENOX_BRANDING.avatarUrl })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

// 5. /watchparty [title] [link] [time]
export const watchpartyCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('watchparty')
    .setDescription('Schedule or announce a community watch party with an interactive RSVP button')
    .addStringOption(opt =>
      opt.setName('title').setDescription('Movie or TV show episode').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('link').setDescription('Direct Zenox stream URL').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt
        .setName('minutes_from_now')
        .setDescription('Starts in how many minutes? (e.g. 15, 30, 60)')
        .setRequired(true)
    ),
  async execute(interaction) {
    const title = interaction.options.getString('title', true);
    const link = interaction.options.getString('link', true);
    const minutes = interaction.options.getInteger('minutes_from_now', true);

    const scheduledTime = Date.now() + minutes * 60 * 1000;

    const wp: WatchParty = {
      id: `wp-${Date.now().toString(36)}`,
      title,
      type: 'movie',
      streamUrl: link.startsWith('http') ? link : `${CONFIG.ZENOX_BASE_URL}/watch/${link}`,
      scheduledTime,
      hostId: interaction.user.id,
      hostTag: interaction.user.tag,
      attendees: [interaction.user.id],
      channelId: interaction.channelId,
      messageId: '',
    };

    db.addWatchParty(wp);

    const payload = ZenoxEmbeds.watchParty(wp);
    const reply = await interaction.reply({ ...payload, fetchReply: true });

    wp.messageId = reply.id;
  },
};

// 6. /nowplaying [title]
export const nowplayingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Share what movie or series you are currently watching on Zenox')
    .addStringOption(opt =>
      opt.setName('title').setDescription('What are you watching?').setRequired(true)
    ),
  async execute(interaction) {
    const title = interaction.options.getString('title', true);
    const embed = ZenoxEmbeds.base(
      '🍿 Now Streaming on Zenox',
      `<@${interaction.user.id}> is currently streaming **${title}** in Ultra HD!\n\nWant to join in? Search for **${title}** on [Zenox](${CONFIG.ZENOX_BASE_URL}).`
    )
      .setAuthor({
        name: interaction.user.displayName || interaction.user.username,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setThumbnail('https://image.tmdb.org/t/p/w600_and_h900_bestv2/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg');

    await interaction.reply({ embeds: [embed] });
  },
};

// 7. /status (Public Website Status Only)
export const statusCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check official zenox.lol website status and streaming availability'),
  async execute(interaction) {
    await interaction.deferReply();
    const nodes = await StatusService.refreshStatus();
    const payload = ZenoxEmbeds.systemStatus(nodes);
    await interaction.editReply(payload);
  },
};

// 8. /domain
export const domainCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('domain')
    .setDescription('Get official working Zenox streaming domains and proxy mirrors'),
  async execute(interaction) {
    const payload = ZenoxEmbeds.domainList();
    await interaction.reply(payload);
  },
};

// 9. /chat [prompt] (Talk With the Bot)
export const chatCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Talk with Zenox AI about movies, shows, streaming tips, or recommendations')
    .addStringOption(opt =>
      opt.setName('prompt').setDescription('What would you like to ask Zenox?').setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const prompt = interaction.options.getString('prompt', true);
    const reply = await AiChatService.answer(prompt, interaction.user.username);
    await interaction.editReply({ content: reply });
  },
};

// 10. /botinfo (Bot Diagnostics & Telemetry)
export const botinfoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('View Zenox bot system metrics, uptime, latency, and platform stats'),
  async execute(interaction) {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const uptimeStr = `${days > 0 ? `${days}d ` : ''}${hours}h ${minutes}m ${seconds}s`;

    const memoryMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const ping = interaction.client.ws.ping;
    const memberCount = interaction.guild?.memberCount || 0;
    const adminChanId = db.getAdminChannelId();
    const reqsChanId = db.getRequestsChannelId();

    const embed = new EmbedBuilder()
      .setTitle('⚡ Zenox Bot Core Telemetry')
      .setColor(ZENOX_COLORS.emerald)
      .setThumbnail(ZENOX_BRANDING.avatarUrl)
      .setDescription(
        `Official Discord bot and streaming cinema engine for [**zenox.lol**](https://zenox.lol).\n` +
        `Ultra HD streams, dynamic subtitles, community watch parties & automatic media requests.`
      )
      .addFields(
        { name: '📶 Gateway Ping', value: `\`${ping}ms\``, inline: true },
        { name: '⏱️ Process Uptime', value: `\`${uptimeStr}\``, inline: true },
        { name: '💾 Memory Usage', value: `\`${memoryMb} MB\``, inline: true },
        { name: '🛡️ Admin Chat', value: adminChanId ? `<#${adminChanId}>` : '`Not Set`', inline: true },
        { name: '📥 Requests Channel', value: reqsChanId ? `<#${reqsChanId}>` : '`Not Set`', inline: true },
        { name: '👥 Server Members', value: `\`${memberCount.toLocaleString()}\``, inline: true },
        { name: '🌐 Official Platform', value: `[zenox.lol](https://zenox.lol)`, inline: true }
      )
      .setFooter({ text: 'Zenox Cyberpunk Cinema Edition • v2.4.0-PRO', iconURL: ZENOX_BRANDING.avatarUrl })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

// 11. /say [message] [channel] [as_embed] [title] [color] (ADMIN ONLY & ADMIN CHANNEL ONLY)
export const sayCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Type and send a message or styled embed through Zenox to any channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption(opt =>
      opt.setName('message').setDescription('Message content or embed description to send').setRequired(true)
    )
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('Target channel to dispatch message to (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('as_embed').setDescription('Format as a sleek Zenox glass embed').setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('title').setDescription('Embed title (if as_embed is true)').setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('color')
        .setDescription('Embed color accent')
        .setRequired(false)
        .addChoices(
          { name: '🟢 Emerald (#22c55e)', value: 'emerald' },
          { name: '🟣 Purple (#a855f7)', value: 'purple' },
          { name: '🔵 Cyan (#06b6d4)', value: 'cyan' },
          { name: '🟡 Amber (#f59e0b)', value: 'amber' },
          { name: '🔴 Rose (#f43f5e)', value: 'rose' }
        )
    ),
  async execute(interaction) {
    if (!(await ensureAdminContext(interaction))) return;

    const message = interaction.options.getString('message', true);
    const targetChannel =
      (interaction.options.getChannel('channel') as TextChannel) || (interaction.channel as TextChannel);
    const asEmbed = interaction.options.getBoolean('as_embed') ?? false;
    const title = interaction.options.getString('title');
    const colorChoice = interaction.options.getString('color') || 'emerald';

    if (!targetChannel || !('send' in targetChannel)) {
      await interaction.reply({ content: '❌ Target channel is invalid or cannot be messaged.', flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      if (asEmbed) {
        const colorMap: Record<string, number> = {
          emerald: ZENOX_COLORS.emerald,
          purple: ZENOX_COLORS.violet,
          cyan: ZENOX_COLORS.cyan,
          amber: ZENOX_COLORS.amber,
          rose: ZENOX_COLORS.rose,
        };

        const embed = new EmbedBuilder()
          .setDescription(message)
          .setColor(colorMap[colorChoice] || ZENOX_COLORS.emerald)
          .setFooter({
            text: 'Zenox Cinema Network • Official Broadcast',
            iconURL: ZENOX_BRANDING.avatarUrl,
          })
          .setTimestamp();

        if (title) embed.setTitle(title);

        await targetChannel.send({ embeds: [embed] });
      } else {
        await targetChannel.send({ content: message });
      }

      db.addBotMessage({
        id: `msg-${Date.now().toString(36)}`,
        channelId: targetChannel.id,
        channelName: targetChannel.name,
        content: message,
        isEmbed: asEmbed,
        embedTitle: title || undefined,
        timestamp: Date.now(),
      });

      await interaction.reply({
        content: `✅ Message sent through **Zenox** to <#${targetChannel.id}>!`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err: any) {
      await interaction.reply({
        content: `❌ Failed to send message to <#${targetChannel.id}>: ${err.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

// 12. /requests [list | resolve] (PUBLIC LIST / ADMIN RESOLVE)
export const requestsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('requests')
    .setDescription('View community media requests or resolve tickets')
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('View community media requests and their status (Public)')
        .addStringOption(opt =>
          opt
            .setName('status')
            .setDescription('Filter by request status')
            .setRequired(false)
            .addChoices(
              { name: 'All Requests', value: 'all' },
              { name: 'Pending Review', value: 'pending' },
              { name: 'Approved', value: 'approved' },
              { name: 'Added to Catalog', value: 'added' },
              { name: 'Rejected', value: 'rejected' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('resolve')
        .setDescription('Approve, add, or reject a request ticket (Admin Only)')
        .addStringOption(opt => opt.setName('ticket_id').setDescription('ID of the request ticket (e.g. req-xxx)').setRequired(true))
        .addStringOption(opt =>
          opt
            .setName('action')
            .setDescription('Action to take')
            .setRequired(true)
            .addChoices(
              { name: 'Approve Request', value: 'approved' },
              { name: 'Mark Added to Catalog', value: 'added' },
              { name: 'Reject Request', value: 'rejected' }
            )
        )
        .addStringOption(opt => opt.setName('notes').setDescription('Staff notes / reason').setRequired(false))
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const filter = interaction.options.getString('status') || 'all';
      let reqs = db.getRequests();
      if (filter !== 'all') {
        reqs = reqs.filter(r => r.status === filter);
      }

      if (reqs.length === 0) {
        await interaction.reply({
          content: `📭 No requests found with status \`${filter.toUpperCase()}\`. Use \`/request\` to submit one!`,
        });
        return;
      }

      const statusIcons: Record<string, string> = {
        pending: '🟡 PENDING',
        approved: '🟢 APPROVED',
        added: '🎉 ADDED',
        rejected: '🔴 REJECTED',
      };

      const lines = reqs.slice(0, 15).map(r =>
        `• \`#${r.id}\` **${r.title}** (${r.type.toUpperCase()}${r.year ? ` ${r.year}` : ''}) — ${statusIcons[r.status]} (by <@${r.requesterId}>)`
      );

      const embed = new EmbedBuilder()
        .setTitle(`🎬 Zenox Community Media Requests (${filter.toUpperCase()})`)
        .setColor(ZENOX_COLORS.emerald)
        .setDescription(
          `Showing **${lines.length}** of **${reqs.length}** community requests:\n\n` +
          lines.join('\n') +
          (reqs.length > 15 ? `\n\n*...and ${reqs.length - 15} more.*` : '') +
          `\n\n💡 Want to request a title? Use \`/request [title] [type]\`!`
        )
        .setFooter({ text: 'Zenox Cinema Library • zenox.lol', iconURL: ZENOX_BRANDING.avatarUrl })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'resolve') {
      if (!(await ensureAdminContext(interaction))) return;

      const ticketId = interaction.options.getString('ticket_id', true);
      const action = interaction.options.getString('action', true) as 'approved' | 'added' | 'rejected';
      const notes = interaction.options.getString('notes') || `Resolved via /requests by ${interaction.user.tag}`;

      const updated = db.updateRequestStatus(ticketId, action, notes, interaction.user.tag);
      if (!updated) {
        await interaction.reply({ content: `❌ Request ticket with ID \`${ticketId}\` was not found.`, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.reply({
        content: `✅ Request \`#${ticketId}\` (**${updated.title}**) has been updated to **${action.toUpperCase()}**!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  },
};

// 13. /announce [title] [message] [channel] [ping_role] (ADMIN ONLY & ADMIN CHANNEL ONLY)
export const announceCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Broadcast a styled Zenox cinema announcement embed')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption(opt => opt.setName('title').setDescription('Announcement headline').setRequired(true))
    .addStringOption(opt => opt.setName('message').setDescription('Main announcement body text').setRequired(true))
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('Channel to broadcast to (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )
    .addRoleOption(opt => opt.setName('ping_role').setDescription('Role to mention').setRequired(false)),
  async execute(interaction) {
    if (!(await ensureAdminContext(interaction))) return;

    const title = interaction.options.getString('title', true);
    const message = interaction.options.getString('message', true);
    const role = interaction.options.getRole('ping_role');
    const targetChannel =
      (interaction.options.getChannel('channel') as TextChannel) || (interaction.channel as TextChannel);

    if (!targetChannel || !('send' in targetChannel)) {
      await interaction.reply({ content: '❌ Target channel cannot receive messages.', flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = ZenoxEmbeds.announcement(title, message, 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200');

    await targetChannel.send({
      content: role ? `<@&${role.id}>` : undefined,
      embeds: [embed],
    });

    await interaction.reply({
      content: `✅ Announcement broadcasted successfully to <#${targetChannel.id}>!`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

// 14. /panel [type] [channel] (ADMIN ONLY & ADMIN CHANNEL ONLY)
export const panelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Deploy aesthetic Zenox reaction & button role panels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption(opt =>
      opt
        .setName('type')
        .setDescription('Which panel to spawn')
        .setRequired(true)
        .addChoices(
          { name: '🎨 Colors (Exclusive name color picker)', value: 'colors' },
          { name: '🔔 Ping Roles (Notification toggles)', value: 'pings' },
          { name: '📺 TV Show Channels (Spoiler access & counters)', value: 'shows' },
          { name: '✨ All Panels (Complete onboarding setup)', value: 'all' }
        )
    )
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('Channel to deploy panel into (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),
  async execute(interaction) {
    if (!(await ensureAdminContext(interaction))) return;

    const panelType = interaction.options.getString('type', true) as 'colors' | 'pings' | 'shows' | 'all';
    const targetChannel =
      (interaction.options.getChannel('channel') as TextChannel) || (interaction.channel as TextChannel);

    if (!targetChannel || !('send' in targetChannel)) {
      await interaction.reply({ content: '❌ Panels can only be spawned in text channels.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({
      content: `⚡ Spawning **${panelType.toUpperCase()}** panel into <#${targetChannel.id}>...`,
      flags: MessageFlags.Ephemeral,
    });

    if (panelType === 'colors' || panelType === 'all') {
      const colorPayload = ZenoxEmbeds.createColorPanel();
      await targetChannel.send(colorPayload);
    }

    if (panelType === 'pings' || panelType === 'all') {
      const pingPayload = ZenoxEmbeds.createPingPanel();
      await targetChannel.send(pingPayload);
    }

    if (panelType === 'shows' || panelType === 'all') {
      const showPayload = ZenoxEmbeds.createShowPanel();
      await targetChannel.send(showPayload as any);
    }
  },
};

// 15. /adminsetup (Dedicated Server Administrator Setup)
export const adminsetupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('adminsetup')
    .setDescription('Configure Zenox administrator channel, synchronize roles, and deploy role panels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('channel')
        .setDescription('Set the dedicated admin chat channel for bot management and administrator commands')
        .addChannelOption(opt =>
          opt
            .setName('admin_channel')
            .setDescription('Target admin text channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('requests_channel')
        .setDescription('Set the channel where media request tickets are sent')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Target requests text channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('color_roles')
        .setDescription('Create or sync all color roles in Discord and optionally deploy the interactive panel')
        .addChannelOption(opt =>
          opt
            .setName('deploy_channel')
            .setDescription('Channel to deploy the Color Roles panel (optional)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('movie_roles')
        .setDescription('Create or sync TV show & movie spoiler channels/roles and optionally deploy panel')
        .addChannelOption(opt =>
          opt
            .setName('deploy_channel')
            .setDescription('Channel to deploy the TV Show & Movie panel (optional)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('ping_roles')
        .setDescription('Set up notification ping roles and optionally deploy the panel')
        .addChannelOption(opt =>
          opt
            .setName('deploy_channel')
            .setDescription('Channel to deploy the Notification Pings panel (optional)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('View current Zenox admin channel, requests channel, and role synchronization status')
    )
    .addSubcommand(sub =>
      sub
        .setName('unlock_commands')
        .setDescription('Ensure public commands work for everyone in all server channels')
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({ content: '❌ This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === 'channel') {
      if (!(await ensureAdminContext(interaction, { allowConfigChannel: true }))) return;

      const channel = interaction.options.getChannel('admin_channel', true) as TextChannel;
      db.setAdminChannelId(channel.id);

      const embed = new EmbedBuilder()
        .setTitle('🛡️ Zenox Admin Chat Channel Configured')
        .setColor(ZENOX_COLORS.emerald)
        .setDescription(
          `The dedicated administrator channel has been set to <#${channel.id}> (\`${channel.id}\`).\n\n` +
          `• **Administrator Commands**: High-privilege management commands (\`/say\`, \`/panel\`, \`/announce\`, \`/requests\`) must now be performed in this channel.\n` +
          `• **Staff Review Tickets**: Content requests submitted via \`/request\` will be routed here (unless a separate requests channel is set via \`/adminsetup requests_channel\`).\n` +
          `• **Manual File Configuration**: You can also set \`ADMIN_CHANNEL_ID=${channel.id}\` manually in your \`.env\` file or in \`data/zenox_db.json\`!\n` +
          `• **Channel Permissions**: Ensure only server administrators have access to <#${channel.id}>.`
        )
        .setFooter({ text: 'Zenox Admin Core • zenox.lol', iconURL: ZENOX_BRANDING.avatarUrl })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    // For all other subcommands, enforce administrator context in the designated admin channel
    if (!(await ensureAdminContext(interaction))) return;

    if (subcommand === 'requests_channel') {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      db.setRequestsChannelId(channel.id);

      const embed = new EmbedBuilder()
        .setTitle('📥 Zenox Media Requests Channel Configured')
        .setColor(ZENOX_COLORS.emerald)
        .setDescription(
          `Media requests submitted via \`/request\` will now be forwarded to <#${channel.id}> (\`${channel.id}\`).\n\n` +
          `• Each request will post an interactive review ticket with **Approve**, **Mark Added**, and **Reject** buttons.\n` +
          `• Only administrators and staff members can interact with review buttons.\n` +
          `• You can also configure this manually by setting \`REQUESTS_CHANNEL_ID=${channel.id}\` in \`.env\`.`
        )
        .setFooter({ text: 'Zenox Admin Core • zenox.lol', iconURL: ZENOX_BRANDING.avatarUrl })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === 'color_roles') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const deployChannel = interaction.options.getChannel('deploy_channel') as TextChannel | null;

      const currentColors = db.getColorRoles();
      const existingRoles = await guild.roles.fetch();
      let createdCount = 0;
      let linkedCount = 0;
      const updatedColors: ColorRoleDef[] = [];

      for (const col of currentColors) {
        let matchingRole = col.discordRoleId ? existingRoles.get(col.discordRoleId) : null;
        if (!matchingRole) {
          matchingRole = existingRoles.find(
            r => r.name.toLowerCase() === col.name.toLowerCase() || r.name.toLowerCase() === `@${col.name.toLowerCase()}`
          ) || null;
        }

        if (matchingRole) {
          linkedCount++;
          updatedColors.push({ ...col, discordRoleId: matchingRole.id });
        } else {
          try {
            const newRole = await guild.roles.create({
              name: col.name,
              color: col.hex as `#${string}`,
              permissions: [],
              reason: 'Zenox Admin Setup / Color Roles',
            });
            createdCount++;
            updatedColors.push({ ...col, discordRoleId: newRole.id });
          } catch (err) {
            console.warn(`Could not create role ${col.name}:`, err);
            updatedColors.push(col);
          }
        }
      }

      db.setColorRoles(updatedColors);

      let deployMessage = '';
      if (deployChannel && deployChannel.type === ChannelType.GuildText) {
        try {
          const panelPayload = ZenoxEmbeds.createColorPanel(updatedColors);
          await deployChannel.send(panelPayload);
          deployMessage = `\n\n🚀 **Live Panel Deployed**: Dispatched to <#${deployChannel.id}>!`;
        } catch (err: any) {
          deployMessage = `\n\n⚠️ Failed to deploy panel to <#${deployChannel.id}>: ${err.message}`;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('🎨 Zenox Color Roles Setup Complete')
        .setColor(ZENOX_COLORS.emerald)
        .setDescription(
          `Successfully synchronized **${updatedColors.length}** custom color roles for **${guild.name}**:\n\n` +
          `• **New Roles Created:** \`${createdCount}\`\n` +
          `• **Existing Roles Linked:** \`${linkedCount}\`\n\n` +
          updatedColors.map(c => `${c.emoji} \`@${c.name}\` (${c.hex})`).join('\n') +
          deployMessage
        )
        .setFooter({ text: 'Zenox Role Dispatcher • Single-choice exclusive logic enabled' });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'movie_roles') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const deployChannel = interaction.options.getChannel('deploy_channel') as TextChannel | null;

      const existingRoles = await guild.roles.fetch();
      let createdCount = 0;
      let linkedCount = 0;

      for (const show of DEFAULT_SHOW_ROLES) {
        const matchingRole = existingRoles.find(
          r => r.name.toLowerCase() === show.name.toLowerCase() || r.name.toLowerCase() === `@${show.name.toLowerCase()}`
        );

        if (matchingRole) {
          linkedCount++;
        } else {
          try {
            await guild.roles.create({
              name: show.name,
              color: 0x06b6d4,
              permissions: [],
              reason: 'Zenox Admin Setup / Movie & TV Show Roles',
            });
            createdCount++;
          } catch (err) {
            console.warn(`Could not create role ${show.name}:`, err);
          }
        }
      }

      let deployMessage = '';
      if (deployChannel && deployChannel.type === ChannelType.GuildText) {
        try {
          const panelPayload = ZenoxEmbeds.createShowPanel();
          await deployChannel.send(panelPayload as any);
          deployMessage = `\n\n🚀 **Live Panel Deployed**: Dispatched to <#${deployChannel.id}>!`;
        } catch (err: any) {
          deployMessage = `\n\n⚠️ Failed to deploy panel to <#${deployChannel.id}>: ${err.message}`;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('📺 TV Show & Movie Roles Setup Complete')
        .setColor(ZENOX_COLORS.emerald)
        .setDescription(
          `Synchronized TV show & movie spoiler discussion access roles for **${guild.name}**:\n\n` +
          `• **New Roles Created:** \`${createdCount}\`\n` +
          `• **Existing Roles Linked:** \`${linkedCount}\`\n\n` +
          DEFAULT_SHOW_ROLES.map(s => `${s.emoji} \`@${s.name}\` (${s.genre})`).join('\n') +
          deployMessage
        )
        .setFooter({ text: 'Zenox TV Show Hub • Exclusive spoiler channel access' });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'ping_roles') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const deployChannel = interaction.options.getChannel('deploy_channel') as TextChannel | null;

      const existingRoles = await guild.roles.fetch();
      let createdCount = 0;
      let linkedCount = 0;

      for (const ping of DEFAULT_PING_ROLES) {
        const matchingRole = existingRoles.find(
          r => r.name.toLowerCase() === ping.name.toLowerCase() || r.name.toLowerCase() === `@${ping.name.toLowerCase()}`
        );

        if (matchingRole) {
          linkedCount++;
        } else {
          try {
            await guild.roles.create({
              name: ping.name,
              color: 0xa855f7,
              permissions: [],
              reason: 'Zenox Admin Setup / Notification Roles',
            });
            createdCount++;
          } catch (err) {
            console.warn(`Could not create ping role ${ping.name}:`, err);
          }
        }
      }

      let deployMessage = '';
      if (deployChannel && deployChannel.type === ChannelType.GuildText) {
        try {
          const panelPayload = ZenoxEmbeds.createPingPanel();
          await deployChannel.send(panelPayload);
          deployMessage = `\n\n🚀 **Live Panel Deployed**: Dispatched to <#${deployChannel.id}>!`;
        } catch (err: any) {
          deployMessage = `\n\n⚠️ Failed to deploy panel to <#${deployChannel.id}>: ${err.message}`;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('🔔 Notification Ping Roles Setup Complete')
        .setColor(ZENOX_COLORS.emerald)
        .setDescription(
          `Notification ping roles synchronized for **${guild.name}**:\n\n` +
          `• **New Roles Created:** \`${createdCount}\`\n` +
          `• **Existing Roles Linked:** \`${linkedCount}\`\n\n` +
          DEFAULT_PING_ROLES.map(p => `${p.emoji} \`@${p.name}\` — *${p.description}*`).join('\n') +
          deployMessage
        )
        .setFooter({ text: 'Zenox Notification Dispatcher' });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'status') {
      const adminChanId = db.getAdminChannelId();
      const reqsChanId = db.getRequestsChannelId();
      const colorCount = db.getColorRoles().length;
      const totalRequests = db.getRequests().length;

      const embed = new EmbedBuilder()
        .setTitle('🛡️ Zenox Server Administration Status')
        .setColor(ZENOX_COLORS.emerald)
        .setDescription(
          `**Server Configuration Overview:**\n\n` +
          `• **Admin Chat Channel:** ${adminChanId ? `<#${adminChanId}> (\`${adminChanId}\`)` : '`Not Set (Use /adminsetup channel)`'}\n` +
          `• **Requests Channel:** ${reqsChanId ? `<#${reqsChanId}> (\`${reqsChanId}\`)` : '`Not Set (Defaults to Admin Chat)`'}\n` +
          `• **Color Roles:** \`${colorCount}\` custom roles configured\n` +
          `• **TV Show / Movie Roles:** \`${DEFAULT_SHOW_ROLES.length}\` shows tracked\n` +
          `• **Notification Ping Roles:** \`${DEFAULT_PING_ROLES.length}\` alert tiers\n` +
          `• **Total Media Requests:** \`${totalRequests}\` tickets in database\n\n` +
          `*All administrator commands are restricted to <#${adminChanId || 'your-admin-channel'}>.*`
        )
        .setFooter({ text: 'Zenox Admin Core • zenox.lol', iconURL: ZENOX_BRANDING.avatarUrl })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === 'unlock_commands') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // 1. Ensure @everyone role has UseApplicationCommands
      const roles = await guild.roles.fetch();
      const everyone = roles.get(guild.id);
      if (everyone && !everyone.permissions.has(PermissionFlagsBits.UseApplicationCommands)) {
        await everyone.setPermissions(everyone.permissions.add(PermissionFlagsBits.UseApplicationCommands));
      }

      // 2. Clear any channel/category DENY overwrites for UseApplicationCommands
      const channels = await guild.channels.fetch();
      let clearedCount = 0;
      for (const [id, c] of channels) {
        if (!c) continue;
        const overwrite = c.permissionOverwrites?.cache?.get(guild.id);
        if (overwrite && overwrite.deny.has(PermissionFlagsBits.UseApplicationCommands)) {
          await c.permissionOverwrites.edit(guild.id, { UseApplicationCommands: null });
          clearedCount++;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('🔓 Public Commands Unlocked Across All Channels')
        .setColor(ZENOX_COLORS.emerald)
        .setDescription(
          `Successfully verified and unlocked command permissions for **${guild.name}**:\n\n` +
          `• **@everyone Role**: \`UseApplicationCommands\` enabled.\n` +
          `• **Channel Overrides Cleared**: \`${clearedCount}\` channel restrictions removed.\n\n` +
          `Normal public commands (\`/search\`, \`/trending\`, \`/random\`, \`/request\`, \`/chat\`, \`/requests list\`, etc.) are now visible and work for **every member in every channel**.`
        )
        .setFooter({ text: 'Zenox Permission Manager • zenox.lol', iconURL: ZENOX_BRANDING.avatarUrl });

      await interaction.editReply({ embeds: [embed] });
      return;
    }
  },
};

export const ALL_COMMANDS: Command[] = [
  searchCommand,
  trendingCommand,
  randomCommand,
  requestCommand,
  watchpartyCommand,
  nowplayingCommand,
  statusCommand,
  domainCommand,
  chatCommand,
  botinfoCommand,
  sayCommand,
  requestsCommand,
  announceCommand,
  panelCommand,
  adminsetupCommand,
];
