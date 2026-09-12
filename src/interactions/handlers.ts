import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { RoleService } from '../services/roles.js';
import { db } from '../database/db.js';
import { ZenoxEmbeds } from '../utils/embeds.js';
import { StatusService } from '../services/status.js';
import { CatalogService } from '../services/catalog.js';
import { CONFIG } from '../config.js';
import { WatchParty } from '../types/index.js';

export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;
  const member = interaction.member as GuildMember;

  // 1. Color role buttons (color_*)
  if (customId.startsWith('color_')) {
    const colorId = customId.replace('color_', '');
    const res = await RoleService.handleColorRole(member, colorId);
    await interaction.reply({
      content: res.message,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 2. Ping role buttons (ping_*)
  if (customId.startsWith('ping_')) {
    const pingId = customId.replace('ping_', '');
    const res = await RoleService.handlePingRole(member, pingId);
    await interaction.reply({
      content: res.message,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 3. Show access role buttons (show_*)
  if (customId.startsWith('show_')) {
    const showId = customId.replace('show_', '');
    const res = await RoleService.handleShowRole(member, showId);
    await interaction.reply({
      content: res.message,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 4. Watch Party RSVP (wp_rsvp_*)
  if (customId.startsWith('wp_rsvp_')) {
    const wpId = customId.replace('wp_rsvp_', '');
    const res = db.toggleRSVP(wpId, interaction.user.id);
    if (!res) {
      await interaction.reply({ content: '❌ Watch party not found or ended.', flags: MessageFlags.Ephemeral });
      return;
    }

    const wp = db.getWatchParty(wpId);
    if (wp) {
      const updatedPayload = ZenoxEmbeds.watchParty(wp);
      await interaction.update(updatedPayload as any);
    } else {
      await interaction.reply({
        content: res.attending
          ? `🎟️ RSVP confirmed! We'll notify you when the watch party begins.`
          : `👋 You have removed your RSVP.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  // 5. Staff Request Buttons (req_approve_*, req_added_*, req_reject_*)
  if (customId.startsWith('req_')) {
    const adminChanId = db.getAdminChannelId();
    const isStaff =
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      member.permissions.has(PermissionFlagsBits.ManageGuild) ||
      (Boolean(adminChanId) && interaction.channelId === adminChanId);

    if (!isStaff) {
      await interaction.reply({
        content: '❌ **Access Denied**: Only administrators and server staff can resolve media request tickets.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const parts = customId.split('_');
    const action = parts[1]; // approve, added, reject
    const reqId = parts.slice(2).join('_');

    const statusMap: Record<string, 'approved' | 'added' | 'rejected'> = {
      approve: 'approved',
      added: 'added',
      reject: 'rejected',
    };

    const newStatus = statusMap[action];
    if (!newStatus) return;

    const updated = db.updateRequestStatus(
      reqId,
      newStatus,
      `Updated by ${interaction.user.tag}`,
      interaction.user.tag
    );

    if (!updated) {
      await interaction.reply({ content: '❌ Request ticket not found.', flags: MessageFlags.Ephemeral });
      return;
    }

    const payload = ZenoxEmbeds.requestTicket(updated);
    await interaction.update(payload as any);

    // Try to notify the user via DM
    try {
      const targetUser = await interaction.client.users.fetch(updated.requesterId);
      if (targetUser) {
        const dmEmbed = ZenoxEmbeds.base(
          `🎬 Request Update: ${updated.title}`,
          `Your content request for **${updated.title}** has been marked as **${newStatus.toUpperCase()}** by <@${interaction.user.id}>!\n\n` +
          (newStatus === 'added' ? `▶ It is now live on [Zenox](https://zenox.lol)!` : `Thank you for contributing to the Zenox catalog.`)
        );
        await targetUser.send({ embeds: [dmEmbed] });
      }
    } catch {
      // User has DMs closed
    }
    return;
  }

  // 6. Refresh Status
  if (customId === 'status_refresh') {
    await interaction.deferUpdate();
    const nodes = await StatusService.refreshStatus();
    const payload = ZenoxEmbeds.systemStatus(nodes);
    await interaction.editReply(payload as any);
    return;
  }

  // 7. Random reroll
  if (customId === 'random_reroll' || customId.startsWith('random_reroll_')) {
    await interaction.deferUpdate();
    const item = await CatalogService.getRandom();
    const payload = ZenoxEmbeds.mediaDetail(item);
    await interaction.editReply(payload as any);
    return;
  }

  // 8. Share Title
  if (customId.startsWith('share_')) {
    const mediaId = customId.replace('share_', '');
    const catalog = CatalogService.getCatalog();
    const item = catalog.find(m => m.id === mediaId) || (await CatalogService.getRandom());
    await interaction.reply({
      content: `🎬 Stream **${item.title}** (${item.year}) on Zenox: ${item.zenoxUrl}`,
    });
    return;
  }

  // 9. Host Watch Party (from media detail card)
  if (customId.startsWith('watchparty_host_')) {
    const mediaId = customId.replace('watchparty_host_', '');
    const embed = interaction.message.embeds[0];
    const rawTitle = embed?.title || 'Community Watch Party';
    const cleanTitle = rawTitle.replace(/\s*\(\d{4}\)$/, '').trim();
    const streamUrl = embed?.url || `${CONFIG.ZENOX_BASE_URL}/watch/${mediaId}`;
    const scheduledTime = Date.now() + 15 * 60 * 1000;

    const wp: WatchParty = {
      id: `wp-${Date.now().toString(36)}`,
      title: cleanTitle,
      type: mediaId.startsWith('tv') ? 'series' : 'movie',
      streamUrl,
      scheduledTime,
      channelId: interaction.channelId,
      hostId: interaction.user.id,
      hostTag: interaction.user.tag,
      attendees: [interaction.user.id],
      messageId: '',
    };

    db.addWatchParty(wp);
    const payload = ZenoxEmbeds.watchParty(wp);

    if (interaction.channel && 'send' in interaction.channel) {
      const sent = await (interaction.channel as any).send(payload);
      wp.messageId = sent.id;
    }

    await interaction.reply({
      content: `🍿 **Watch Party Scheduled!** You started a watch party for **${cleanTitle}** (starts <t:${Math.floor(scheduledTime / 1000)}:R>). The RSVP card has been posted into this channel!`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 9. Paginated Help Menu Buttons
  if (customId === 'help_close') {
    try {
      await interaction.message.delete();
    } catch {
      await interaction.update({ content: '🔒 *Help menu closed.*', embeds: [], components: [] });
    }
    return;
  }

  if (customId.startsWith('help_cat_')) {
    const page = parseInt(customId.replace('help_cat_', ''), 10) || 0;
    const prefix = db.getPrefix();
    const payload = ZenoxEmbeds.createHelpMenu(page, prefix);
    await interaction.update(payload as any);
    return;
  }

  if (customId.startsWith('help_prev_')) {
    const cur = parseInt(customId.replace('help_prev_', ''), 10) || 0;
    const page = Math.max(0, cur - 1);
    const prefix = db.getPrefix();
    const payload = ZenoxEmbeds.createHelpMenu(page, prefix);
    await interaction.update(payload as any);
    return;
  }

  if (customId.startsWith('help_next_')) {
    const cur = parseInt(customId.replace('help_next_', ''), 10) || 0;
    const page = Math.min(3, cur + 1);
    const prefix = db.getPrefix();
    const payload = ZenoxEmbeds.createHelpMenu(page, prefix);
    await interaction.update(payload as any);
    return;
  }
}

export async function handleSelectInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
  if (interaction.customId === 'select_show_roles') {
    const selectedShowIds = interaction.values;
    const member = interaction.member as GuildMember;
    const results: string[] = [];

    for (const showId of selectedShowIds) {
      const res = await RoleService.handleShowRole(member, showId);
      results.push(`${res.showName}: ${res.added ? 'Unlocked 🔓' : 'Removed 🔒'}`);
    }

    await interaction.reply({
      content: `**TV Show Preferences Updated:**\n` + results.map(r => `• ${r}`).join('\n'),
      flags: MessageFlags.Ephemeral,
    });
  }
}
