import {
  Message,
  Client,
  TextChannel,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { db } from '../database/db.js';
import { CatalogService } from '../services/catalog.js';
import { StatusService } from '../services/status.js';
import { AiChatService } from '../services/aiChat.js';
import { ZenoxEmbeds } from '../utils/embeds.js';
import { ZENOX_COLORS, ZENOX_BRANDING, DEFAULT_SHOW_ROLES, DEFAULT_PING_ROLES } from '../utils/branding.js';
import { ContentRequest, WatchParty } from '../types/index.js';
import { ensureAdminContextForMessage } from './index.js';

export async function handlePrefixMessage(message: Message, client: Client): Promise<void> {
  if (message.author.bot) return;

  const prefix = db.getPrefix();
  if (!message.content.startsWith(prefix)) return;

  const raw = message.content.slice(prefix.length).trim();
  if (!raw) return;

  const args = raw.split(/\s+/);
  const command = args.shift()?.toLowerCase();
  if (!command) return;

  const fullArgString = raw.slice(command.length).trim();

  try {
    switch (command) {
      // 1. HELP / COMMANDS
      case 'help':
      case 'commands':
      case 'h': {
        const isAdminMember = message.member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
        const adminChanId = db.getAdminChannelId();
        const inAdminChannel = !adminChanId || message.channelId === adminChanId;
        const canAccessAdminHelp = isAdminMember && inAdminChannel;

        let page = 0;
        const target = args[0]?.toLowerCase();
        if (target === 'media' || target === '1') {
          page = 1;
        } else if (target === 'community' || target === 'requests' || target === '2') {
          page = 2;
        } else if (target === 'admin' || target === 'setup' || target === '3') {
          if (!isAdminMember) {
            await message.reply('❌ **Access Denied**: Administrator documentation is restricted to server administrators.');
            return;
          }
          if (!inAdminChannel) {
            await message.reply(
              `🔒 **Admin Channel Restricted**: Administrator documentation and commands can only be viewed in the designated admin chat: <#${adminChanId}>.`
            );
            return;
          }
          page = 3;
        }

        const payload = ZenoxEmbeds.createHelpMenu(page, prefix, canAccessAdminHelp);
        await message.reply(payload);
        return;
      }

      // Dedicated Admin Help Prefix Command
      case 'adminhelp':
      case 'helpadmin': {
        const isAdminMember = message.member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
        if (!isAdminMember) {
          await message.reply('❌ **Access Denied**: Administrator documentation is restricted to server administrators.');
          return;
        }

        const adminChanId = db.getAdminChannelId();
        const inAdminChannel = !adminChanId || message.channelId === adminChanId;
        if (!inAdminChannel) {
          await message.reply(
            `🔒 **Admin Channel Restricted**: Administrator documentation and commands can only be viewed in the designated admin chat: <#${adminChanId}>.`
          );
          return;
        }

        const payload = ZenoxEmbeds.createHelpMenu(3, prefix, true);
        await message.reply(payload);
        return;
      }

      // 2. PREFIX
      case 'prefix': {
        if (!args.length) {
          const isAdminMember = message.member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
          const adminChanId = db.getAdminChannelId();
          const inAdminChannel = !adminChanId || message.channelId === adminChanId;
          const showAdminGuide = isAdminMember && inAdminChannel;

          const embed = new EmbedBuilder()
            .setTitle('⚡ Zenox Command Prefix')
            .setColor(ZENOX_COLORS.emerald)
            .setDescription(
              `The current server command prefix is: \`${prefix}\`\n\n` +
              `• **Usage Example**: \`${prefix}help\`, \`${prefix}movie Inception\`, \`${prefix}status\`` +
              (showAdminGuide
                ? `\n• **Change Prefix**: \`${prefix}prefix <symbol>\` or \`/adminsetup prefix\` *(Administrator only)*`
                : '')
            )
            .setFooter({ text: 'Zenox Command Dispatcher • zenox.lol', iconURL: ZENOX_BRANDING.avatarUrl });
          await message.reply({ embeds: [embed] });
          return;
        }

        if (!(await ensureAdminContextForMessage(message, { allowConfigChannel: true }))) return;
        const newPrefix = args[0].trim();
        db.setPrefix(newPrefix);

        const embed = new EmbedBuilder()
          .setTitle('⚡ Custom Command Prefix Updated')
          .setColor(ZENOX_COLORS.emerald)
          .setDescription(
            `The command prefix for **${message.guild?.name || 'this server'}** has been changed to: \`${newPrefix}\`\n\n` +
            `• Try running: \`${newPrefix}help\`\n` +
            `• Slash commands (\`/help\`) continue to work everywhere.`
          )
          .setFooter({ text: 'Zenox Configuration Manager', iconURL: ZENOX_BRANDING.avatarUrl });

        await message.reply({ embeds: [embed] });
        return;
      }

      // 3. SEARCH / MOVIE / SERIES / ANIME / FIND
      case 'search':
      case 'movie':
      case 'series':
      case 'anime':
      case 'find': {
        if (!fullArgString) {
          await message.reply(`⚠️ **Usage:** \`${prefix}${command} <movie or TV show title>\`\n*Example:* \`${prefix}${command} Inception\``);
          return;
        }

        if ('sendTyping' in message.channel) await message.channel.sendTyping();
        const results = await CatalogService.search(fullArgString);

        if (results.length === 0) {
          await message.reply(`❌ No matching titles found on Zenox for \`${fullArgString}\`. You can request it using \`${prefix}request ${fullArgString}\`!`);
          return;
        }

        const payload = ZenoxEmbeds.mediaDetail(results[0]);
        await message.reply(payload);
        return;
      }

      // 4. TRENDING / TOP
      case 'trending':
      case 'top': {
        if ('sendTyping' in message.channel) await message.channel.sendTyping();
        const trending = await CatalogService.getTrending();
        const payload = ZenoxEmbeds.trendingList(trending);
        await message.reply(payload);
        return;
      }

      // 5. RANDOM / ROLL
      case 'random':
      case 'roll': {
        if ('sendTyping' in message.channel) await message.channel.sendTyping();

        let type: 'movie' | 'tv' | undefined = undefined;
        let genre: string | undefined = undefined;

        const lowerArgs = args.map(a => a.toLowerCase());
        if (lowerArgs[0] === 'movie' || lowerArgs[0] === 'film') {
          type = 'movie';
          if (lowerArgs.length > 1) {
            genre = lowerArgs.slice(1).join(' ');
          }
        } else if (lowerArgs[0] === 'tv' || lowerArgs[0] === 'series' || lowerArgs[0] === 'show') {
          type = 'tv';
          if (lowerArgs.length > 1) {
            genre = lowerArgs.slice(1).join(' ');
          }
        } else if (lowerArgs.length > 0) {
          // e.g. !random action, !random comedy, !random horror
          genre = lowerArgs.join(' ');
        }

        const item = await CatalogService.getRandom(type, genre);
        const payload = ZenoxEmbeds.mediaDetail(item);
        await message.reply(payload);
        return;
      }

      // 6. REQUEST / REQ
      case 'request':
      case 'req': {
        if (!fullArgString) {
          await message.reply(
            `⚠️ **Usage:** \`${prefix}request <movie|series|anime> <title> | [notes]\`\n` +
            `*Example:* \`${prefix}request movie Fight Club\`\n` +
            `*Example:* \`${prefix}request series Severance | Please add Season 2\``
          );
          return;
        }

        let type: 'movie' | 'series' | 'anime' = 'movie';
        let remaining = fullArgString;

        const firstWord = args[0]?.toLowerCase();
        if (firstWord === 'movie') {
          type = 'movie';
          remaining = fullArgString.replace(/^movie\s+/i, '').trim();
        } else if (firstWord === 'series' || firstWord === 'tv' || firstWord === 'show') {
          type = 'series';
          remaining = fullArgString.replace(/^(series|tv|show)\s+/i, '').trim();
        } else if (firstWord === 'anime') {
          type = 'anime';
          remaining = fullArgString.replace(/^anime\s+/i, '').trim();
        }

        let title = remaining;
        let notes: string | undefined = undefined;

        if (remaining.includes('|')) {
          const parts = remaining.split('|');
          title = parts[0].trim();
          notes = parts.slice(1).join('|').trim();
        }

        if (!title) {
          await message.reply(`⚠️ Please provide a movie or TV show title to request.`);
          return;
        }

        const newRequest: ContentRequest = {
          id: `req-${Date.now().toString(36)}`,
          title,
          type,
          requesterId: message.author.id,
          requesterTag: message.author.tag,
          requesterAvatar: message.author.displayAvatarURL(),
          notes,
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        db.addRequest(newRequest);

        // Forward to requests or admin channel
        const targetChannelId = db.getRequestsChannelId() || db.getAdminChannelId();
        if (targetChannelId && message.guild) {
          try {
            const targetCh = (await message.guild.channels.fetch(targetChannelId)) as TextChannel;
            if (targetCh && 'send' in targetCh) {
              const ticketPayload = ZenoxEmbeds.requestTicket(newRequest);
              const msg = await targetCh.send(ticketPayload);
              newRequest.messageId = msg.id;
              newRequest.channelId = targetCh.id;
            }
          } catch (err) {
            console.warn('Could not forward request ticket:', err);
          }
        }

        const embed = new EmbedBuilder()
          .setTitle(`🎬 New Content Request: ${title}`)
          .setColor(ZENOX_COLORS.emerald)
          .setDescription(
            `<@${message.author.id}> requested **${title}** to be added to the Zenox catalog!\n\n` +
            `• **Title**: \`${title}\`\n` +
            `• **Category**: \`${type.toUpperCase()}\`\n` +
            (notes ? `• **Notes**: *${notes}*\n` : '') +
            `• **Status**: \`🟡 PENDING REVIEW\`\n` +
            `• **Ticket ID**: \`#${newRequest.id}\``
          )
          .setFooter({ text: 'Zenox Media Queue • Streaming on zenox.lol', iconURL: ZENOX_BRANDING.avatarUrl })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
        return;
      }

      // 7. REQUESTS (List / Resolve)
      case 'requests':
      case 'reqs': {
        const sub = args[0]?.toLowerCase();

        if (sub === 'resolve') {
          if (!(await ensureAdminContextForMessage(message))) return;

          const reqId = args[1];
          const newStatus = args[2]?.toLowerCase() as 'approved' | 'added' | 'rejected';
          const notes = args.slice(3).join(' ') || undefined;

          if (!reqId || !['approved', 'added', 'rejected'].includes(newStatus)) {
            await message.reply(`⚠️ **Usage:** \`${prefix}requests resolve <req-id> <approved|added|rejected> [notes]\``);
            return;
          }

          const updated = db.updateRequestStatus(reqId, newStatus, notes, message.author.tag);
          if (!updated) {
            await message.reply(`❌ Request ticket \`${reqId}\` not found in database.`);
            return;
          }

          // Update original ticket message if exists
          if (updated.channelId && updated.messageId && message.guild) {
            try {
              const ch = (await message.guild.channels.fetch(updated.channelId)) as TextChannel;
              const originalMsg = await ch.messages.fetch(updated.messageId);
              if (originalMsg) {
                await originalMsg.edit(ZenoxEmbeds.requestTicket(updated) as any);
              }
            } catch {}
          }

          // Send DM to requester
          try {
            const targetUser = await client.users.fetch(updated.requesterId);
            if (targetUser) {
              const dmEmbed = ZenoxEmbeds.base(
                `🎬 Request Update: ${updated.title}`,
                `Your content request for **${updated.title}** has been marked as **${newStatus.toUpperCase()}** by <@${message.author.id}>!\n\n` +
                (notes ? `• **Staff Notes**: *${notes}*\n\n` : '') +
                (newStatus === 'added' ? `▶ It is now live on [Zenox](https://zenox.lol)!` : `Thank you for contributing to the Zenox catalog.`)
              );
              await targetUser.send({ embeds: [dmEmbed] });
            }
          } catch {}

          await message.reply(`✅ Ticket \`${reqId}\` marked as **${newStatus.toUpperCase()}**.`);
          return;
        }

        // List requests
        const requests = db.getRequests();
        const pending = requests.filter(r => r.status === 'pending');
        const count = pending.length;

        const embed = new EmbedBuilder()
          .setTitle('📋 Community Content Requests')
          .setColor(ZENOX_COLORS.emerald)
          .setDescription(
            `**Open Requests:** \`${count}\` tickets pending review.\n\n` +
            (pending.length === 0
              ? `*All requests have been fulfilled! Use \`${prefix}request\` to submit a movie or TV show.*`
              : pending
                  .slice(0, 8)
                  .map(
                    (r, i) =>
                      `**${i + 1}. [${r.type.toUpperCase()}] ${r.title}**\n` +
                      `↳ Requested by <@${r.requesterId}> • ID: \`${r.id}\``
                  )
                  .join('\n\n')) +
            `\n\n💡 *Staff can approve tickets directly using \`${prefix}requests resolve <id> added\` or the buttons in the admin chat.*`
          )
          .setFooter({ text: 'Zenox Content Queue • zenox.lol', iconURL: ZENOX_BRANDING.avatarUrl });

        await message.reply({ embeds: [embed] });
        return;
      }

      // 8. NOW PLAYING / NP
      case 'nowplaying':
      case 'np': {
        if (!fullArgString) {
          await message.reply(`⚠️ **Usage:** \`${prefix}nowplaying <Title> | [Year] | [Quality]\`\n*Example:* \`${prefix}nowplaying Dune: Part Two | 2024 | 4K HDR\``);
          return;
        }

        const parts = fullArgString.split('|').map(s => s.trim());
        const title = parts[0];
        const year = parts[1] || '2024';
        const quality = parts[2] || 'Ultra HD';

        const embed = ZenoxEmbeds.base(
          '🍿 Now Streaming on Zenox',
          `<@${message.author.id}> is currently streaming **${title}** (${year}) in **${quality}**!\n\nWant to join in? Watch now on [Zenox](https://zenox.lol/watch/${encodeURIComponent(title.toLowerCase().replace(/\s+/g, '-'))}).`
        )
          .setAuthor({
            name: message.author.displayName || message.author.username,
            iconURL: message.author.displayAvatarURL(),
          })
          .setThumbnail('https://image.tmdb.org/t/p/w600_and_h900_bestv2/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg');

        if ('send' in message.channel) {
          await message.channel.send({ embeds: [embed] });
        }
        return;
      }

      // 9. WATCHPARTY / WP
      case 'watchparty':
      case 'wp': {
        if (!fullArgString) {
          await message.reply(
            `⚠️ **Usage:** \`${prefix}watchparty <Title> | <Minutes from now> | [Stream URL]\`\n` +
            `*Example:* \`${prefix}watchparty Interstellar | 30 | https://zenox.lol/watch/157336\``
          );
          return;
        }

        const parts = fullArgString.split('|').map(s => s.trim());
        const title = parts[0];
        const minutes = parseInt(parts[1] || '15', 10) || 15;
        const link = parts[2] || 'https://zenox.lol';

        const scheduledTime = Date.now() + minutes * 60 * 1000;
        const wp: WatchParty = {
          id: `wp-${Date.now().toString(36)}`,
          title,
          type: 'movie',
          hostId: message.author.id,
          hostTag: message.author.tag,
          streamUrl: link,
          scheduledTime,
          channelId: message.channelId,
          messageId: '',
          attendees: [message.author.id],
        };

        db.addWatchParty(wp);
        const payload = ZenoxEmbeds.watchParty(wp);
        if ('send' in message.channel) {
          const sent = await message.channel.send(payload);
          wp.messageId = sent.id;
        }
        return;
      }

      // 10. STATUS / PING
      case 'status':
      case 'ping': {
        if ('sendTyping' in message.channel) await message.channel.sendTyping();
        const nodes = await StatusService.refreshStatus();
        const payload = ZenoxEmbeds.systemStatus(nodes);
        await message.reply(payload);
        return;
      }

      // 11. DOMAIN / SITE / DOMAINS / LINK / MIRRORS
      case 'domain':
      case 'site':
      case 'domains':
      case 'link':
      case 'mirrors': {
        const payload = ZenoxEmbeds.domainList();
        await message.reply(payload);
        return;
      }

      // 12. CHAT / AI / ASK
      case 'chat':
      case 'ai':
      case 'ask': {
        if (!fullArgString) {
          await message.reply(`⚠️ **Usage:** \`${prefix}${command} <your message or question>\`\n*Example:* \`${prefix}${command} Recommend me 3 mind-bending sci-fi movies\``);
          return;
        }

        if ('sendTyping' in message.channel) await message.channel.sendTyping();
        const reply = await AiChatService.answer(fullArgString, message.author.username);
        await message.reply({ content: reply });
        return;
      }

      // 13. BOTINFO / INFO / ABOUT
      case 'botinfo':
      case 'info':
      case 'about': {
        const uptimeSeconds = Math.floor(process.uptime());
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;
        const memMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

        const embed = new EmbedBuilder()
          .setTitle('🤖 Zenox Cinema Bot Specifications')
          .setColor(ZENOX_COLORS.emerald)
          .setThumbnail(ZENOX_BRANDING.avatarUrl)
          .setDescription(
            `**Zenox Cinema Network • Pure Discord Edition**\n` +
            `High-performance streaming assistant with interactive role panels, request tickets, TMDB catalog sync, and native 24/7 cloud keep-alive.\n\n` +
            `• **Command Prefix:** \`${prefix}\`\n` +
            `• **Gateway Ping:** \`${client.ws.ping}ms\`\n` +
            `• **Uptime:** \`${hours}h ${minutes}m ${seconds}s\`\n` +
            `• **Memory Usage:** \`${memMb} MB\`\n` +
            `• **Node Version:** \`${process.version}\`\n` +
            `• **Official Platform:** [zenox.lol](https://zenox.lol)\n` +
            `• **Support Server:** [Join Zenox Discord](${ZENOX_BRANDING.supportDiscord})`
          )
          .setFooter({ text: 'Zenox System Architecture • zenox.lol', iconURL: ZENOX_BRANDING.avatarUrl })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
        return;
      }

      // 14. ADMIN: SAY
      case 'say': {
        if (!(await ensureAdminContextForMessage(message))) return;

        // format: !say <#channel> <message> OR !say -e <#channel> <title> | <message>
        let isEmbed = false;
        let content = fullArgString;

        if (content.startsWith('-e ')) {
          isEmbed = true;
          content = content.slice(3).trim();
        }

        const match = content.match(/^<#(\d+)>\s+([\s\S]+)$/);
        if (!match) {
          await message.reply(
            `⚠️ **Usage:**\n` +
            `• Plain text: \`${prefix}say <#channel> <message>\`\n` +
            `• Rich Embed: \`${prefix}say -e <#channel> <Title> | <Description>\``
          );
          return;
        }

        const targetChannelId = match[1];
        const body = match[2].trim();

        if (!message.guild) return;
        const targetCh = (await message.guild.channels.fetch(targetChannelId)) as TextChannel;
        if (!targetCh || !('send' in targetCh)) {
          await message.reply(`❌ Invalid text channel <#${targetChannelId}>.`);
          return;
        }

        if (isEmbed) {
          const parts = body.split('|');
          const title = parts[0].trim();
          const desc = parts.slice(1).join('|').trim() || title;
          const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(desc)
            .setColor(ZENOX_COLORS.emerald)
            .setFooter({ text: 'Zenox Cinema Broadcast', iconURL: ZENOX_BRANDING.avatarUrl })
            .setTimestamp();
          await targetCh.send({ embeds: [embed] });
        } else {
          await targetCh.send({ content: body });
        }

        await message.reply(`✅ Message dispatched to <#${targetCh.id}>!`);
        return;
      }

      // 15. ADMIN: ANNOUNCE
      case 'announce': {
        if (!(await ensureAdminContextForMessage(message))) return;

        // format: !announce <#channel> <Title> | <Description>
        const match = fullArgString.match(/^<#(\d+)>\s+([\s\S]+)$/);
        if (!match || !match[2].includes('|')) {
          await message.reply(
            `⚠️ **Usage:** \`${prefix}announce <#channel> <Title> | <Description>\`\n` +
            `*Example:* \`${prefix}announce #announcements New 4K Releases | Added 15 new movies to zenox.lol!\``
          );
          return;
        }

        const targetChannelId = match[1];
        const parts = match[2].split('|');
        const title = parts[0].trim();
        const body = parts.slice(1).join('|').trim();

        if (!message.guild) return;
        const targetCh = (await message.guild.channels.fetch(targetChannelId)) as TextChannel;
        if (!targetCh || !('send' in targetCh)) {
          await message.reply(`❌ Invalid target channel <#${targetChannelId}>.`);
          return;
        }

        const embed = ZenoxEmbeds.announcement(title, body, 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200');
        await targetCh.send({ embeds: [embed] });
        await message.reply(`✅ Announcement broadcasted to <#${targetCh.id}>!`);
        return;
      }

      // 16. ADMIN: PANEL
      case 'panel': {
        if (!(await ensureAdminContextForMessage(message))) return;

        const panelType = args[0]?.toLowerCase() as 'colors' | 'pings' | 'shows' | 'all';
        const channelMention = args[1];

        if (!['colors', 'pings', 'shows', 'all'].includes(panelType)) {
          await message.reply(`⚠️ **Usage:** \`${prefix}panel <colors|pings|shows|all> [#channel]\``);
          return;
        }

        let targetCh = message.channel as TextChannel;
        if (channelMention) {
          const m = channelMention.match(/^<#(\d+)>$/);
          if (m && message.guild) {
            const fetched = (await message.guild.channels.fetch(m[1])) as TextChannel;
            if (fetched && 'send' in fetched) targetCh = fetched;
          }
        }

        if (panelType === 'colors' || panelType === 'all') {
          const colorPayload = ZenoxEmbeds.createColorPanel();
          await targetCh.send(colorPayload);
        }
        if (panelType === 'pings' || panelType === 'all') {
          const pingPayload = ZenoxEmbeds.createPingPanel();
          await targetCh.send(pingPayload);
        }
        if (panelType === 'shows' || panelType === 'all') {
          const showPayload = ZenoxEmbeds.createShowPanel();
          await targetCh.send(showPayload as any);
        }

        await message.reply(`✅ Deployed **${panelType.toUpperCase()}** panel to <#${targetCh.id}>!`);
        return;
      }

      // 17. ADMIN: ADMINSETUP
      case 'adminsetup': {
        const sub = args[0]?.toLowerCase();
        const guild = message.guild;
        if (!guild) return;

        if (sub === 'channel') {
          if (!(await ensureAdminContextForMessage(message, { allowConfigChannel: true }))) return;
          const match = args[1]?.match(/^<#(\d+)>$/);
          if (!match) {
            await message.reply(`⚠️ **Usage:** \`${prefix}adminsetup channel <#admin-channel>\``);
            return;
          }
          const chId = match[1];
          db.setAdminChannelId(chId);

          const embed = new EmbedBuilder()
            .setTitle('🛡️ Zenox Admin Chat Channel Configured')
            .setColor(ZENOX_COLORS.emerald)
            .setDescription(
              `The dedicated administrator channel has been set to <#${chId}> (\`${chId}\`).\n\n` +
              `• High-privilege commands (\`${prefix}say\`, \`${prefix}panel\`, \`${prefix}announce\`, \`${prefix}adminsetup\`) must now be run there.\n` +
              `• User media requests will also be dispatched there.`
            )
            .setFooter({ text: 'Zenox Admin Core • zenox.lol', iconURL: ZENOX_BRANDING.avatarUrl });

          await message.reply({ embeds: [embed] });
          return;
        }

        if (sub === 'requests_channel') {
          if (!(await ensureAdminContextForMessage(message, { allowConfigChannel: true }))) return;
          const match = args[1]?.match(/^<#(\d+)>$/);
          if (!match) {
            await message.reply(`⚠️ **Usage:** \`${prefix}adminsetup requests_channel <#channel>\``);
            return;
          }
          const chId = match[1];
          db.setRequestsChannelId(chId);
          await message.reply(`✅ Media requests will now be posted to <#${chId}>.`);
          return;
        }

        if (sub === 'prefix') {
          if (!(await ensureAdminContextForMessage(message, { allowConfigChannel: true }))) return;
          const newP = args[1]?.trim();
          if (!newP) {
            await message.reply(`⚠️ **Usage:** \`${prefix}adminsetup prefix <symbol>\``);
            return;
          }
          db.setPrefix(newP);
          await message.reply(`✅ Command prefix updated to: \`${newP}\`. Try running \`${newP}help\`!`);
          return;
        }

        if (sub === 'unlock_commands') {
          if (!(await ensureAdminContextForMessage(message))) return;
          const roles = await guild.roles.fetch();
          const everyone = roles.get(guild.id);
          if (everyone && !everyone.permissions.has(PermissionFlagsBits.UseApplicationCommands)) {
            await everyone.setPermissions(everyone.permissions.add(PermissionFlagsBits.UseApplicationCommands));
          }

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

          await message.reply(`🔓 Public commands verified & unlocked for everyone across ${clearedCount} channels!`);
          return;
        }

        // Default or status
        if (!(await ensureAdminContextForMessage(message, { allowConfigChannel: true }))) return;
        const adminChanId = db.getAdminChannelId();
        const reqsChanId = db.getRequestsChannelId();
        const colorCount = db.getColorRoles().length;
        const totalRequests = db.getRequests().length;

        const embed = new EmbedBuilder()
          .setTitle('🛡️ Zenox Server Administration Status')
          .setColor(ZENOX_COLORS.emerald)
          .setDescription(
            `**Server Configuration Overview:**\n\n` +
            `• **Command Prefix:** \`${prefix}\`\n` +
            `• **Admin Chat Channel:** ${adminChanId ? `<#${adminChanId}> (\`${adminChanId}\`)` : '`Not Set (Use ' + prefix + 'adminsetup channel #chat)`'}\n` +
            `• **Requests Channel:** ${reqsChanId ? `<#${reqsChanId}> (\`${reqsChanId}\`)` : '`Not Set (Defaults to Admin Chat)`'}\n` +
            `• **Color Roles:** \`${colorCount}\` custom roles configured\n` +
            `• **TV Show / Movie Roles:** \`${DEFAULT_SHOW_ROLES.length}\` shows tracked\n` +
            `• **Notification Ping Roles:** \`${DEFAULT_PING_ROLES.length}\` alert tiers\n` +
            `• **Total Media Requests:** \`${totalRequests}\` tickets in database\n\n` +
            `*All administrator commands are restricted to <#${adminChanId || 'your-admin-channel'}>.*`
          )
          .setFooter({ text: 'Zenox Admin Core • zenox.lol', iconURL: ZENOX_BRANDING.avatarUrl })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
        return;
      }

      default:
        // Not a recognized prefix command; do not spam
        return;
    }
  } catch (err: any) {
    console.error(`[Zenox Prefix Command Error: ${command}]`, err);
    await message.reply(`⚠️ An error occurred while executing \`${prefix}${command}\`: ${err?.message || 'Unknown error'}`);
  }
}
