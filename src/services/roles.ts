import { GuildMember } from 'discord.js';
import { db } from '../database/db.js';
import { DEFAULT_COLOR_ROLES, DEFAULT_PING_ROLES, DEFAULT_SHOW_ROLES } from '../utils/branding.js';

export class RoleService {
  /**
   * Handle single-choice exclusive color role assignment
   * Removes any existing color role on the member before adding the new one
   */
  public static async handleColorRole(
    member: GuildMember,
    colorId: string
  ): Promise<{ success: boolean; message: string; colorName: string }> {
    const allColors = db.getColorRoles();
    const targetColor = allColors.find(c => c.id === colorId);
    if (!targetColor) {
      return { success: false, message: 'Invalid color selected.', colorName: '' };
    }

    const guild = member.guild;
    const allColorNames = allColors.map(c => c.name.toLowerCase());
    const allRoleIds = allColors.map(c => c.discordRoleId).filter(Boolean) as string[];

    // 1. Find matching Discord role by configured ID or name
    let roleToAssign = targetColor.discordRoleId ? guild.roles.cache.get(targetColor.discordRoleId) : null;
    if (!roleToAssign) {
      roleToAssign = guild.roles.cache.find(
        r => r.name.toLowerCase() === targetColor.name.toLowerCase() || r.name.toLowerCase() === `@${targetColor.name.toLowerCase()}`
      ) || null;
    }

    // 2. Remove all existing color roles from the member
    const rolesToRemove = member.roles.cache.filter(r =>
      allRoleIds.includes(r.id) || allColorNames.includes(r.name.toLowerCase().replace('@', ''))
    );

    try {
      if (rolesToRemove.size > 0) {
        await member.roles.remove(rolesToRemove);
      }

      if (roleToAssign) {
        await member.roles.add(roleToAssign);
      }
    } catch (err) {
      // Permission or hierarchy warning in real discord server
      console.warn(`[RoleService] Could not modify Discord roles directly for ${member.user.tag}:`, err);
    }

    // Persist user selection in Zenox DB
    const { previousColor } = db.setColorRole(member.id, colorId);

    const prevName = previousColor ? allColors.find(c => c.id === previousColor)?.name : null;
    let feedback = `Your custom name color has been updated to **${targetColor.name}** ${targetColor.emoji}!`;
    if (prevName) {
      feedback += ` (Replaced previous color: \`${prevName}\`)`;
    }

    return {
      success: true,
      message: feedback,
      colorName: targetColor.name,
    };
  }

  /**
   * Handle toggle for ping / notification roles
   */
  public static async handlePingRole(
    member: GuildMember,
    pingId: string
  ): Promise<{ success: boolean; added: boolean; roleName: string; message: string }> {
    const targetPing = DEFAULT_PING_ROLES.find(p => p.id === pingId);
    if (!targetPing) {
      return { success: false, added: false, roleName: '', message: 'Invalid notification role.' };
    }

    const guild = member.guild;
    const discordRole = guild.roles.cache.find(
      r => r.name.toLowerCase() === targetPing.name.toLowerCase() || r.name.toLowerCase() === `@${targetPing.name.toLowerCase()}`
    );

    let added = false;
    if (discordRole) {
      try {
        if (member.roles.cache.has(discordRole.id)) {
          await member.roles.remove(discordRole);
          added = false;
        } else {
          await member.roles.add(discordRole);
          added = true;
        }
      } catch (err) {
        console.warn(`[RoleService] Failed to toggle role on Discord:`, err);
      }
    } else {
      // Toggle in DB if role doesn't exist in guild
      const res = db.togglePingRole(member.id, pingId);
      added = res.added;
    }

    const feedback = added
      ? `🔔 You will now receive notifications for **${targetPing.name}**!`
      : `🔕 You have opted out of **${targetPing.name}** notifications.`;

    return {
      success: true,
      added,
      roleName: targetPing.name,
      message: feedback,
    };
  }

  /**
   * Handle toggle for TV Show spoiler / channel access roles
   */
  public static async handleShowRole(
    member: GuildMember,
    showId: string
  ): Promise<{ success: boolean; added: boolean; showName: string; message: string; newCount: number }> {
    const targetShow = DEFAULT_SHOW_ROLES.find(s => s.id === showId);
    if (!targetShow) {
      return { success: false, added: false, showName: '', message: 'Invalid TV show selected.', newCount: 0 };
    }

    const guild = member.guild;
    const discordRole = guild.roles.cache.find(
      r => r.name.toLowerCase() === targetShow.name.toLowerCase() || r.name.toLowerCase() === `@${targetShow.name.toLowerCase()}`
    );

    const { added, newCount } = db.toggleShowRole(member.id, showId);

    if (discordRole) {
      try {
        if (added) {
          await member.roles.add(discordRole);
        } else {
          await member.roles.remove(discordRole);
        }
      } catch (err) {
        console.warn(`[RoleService] Failed to assign TV show role on Discord:`, err);
      }
    }

    const feedback = added
      ? `🔓 Unlocked spoiler & discussion channel access for **${targetShow.name}**! (${newCount.toLocaleString()} members)`
      : `🔒 Removed channel access for **${targetShow.name}**.`;

    return {
      success: true,
      added,
      showName: targetShow.name,
      message: feedback,
      newCount,
    };
  }
}
