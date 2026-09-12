import http from 'http';
import {
  Client,
  GatewayIntentBits,
  ActivityType,
  Interaction,
  Events,
  Collection,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { CONFIG } from './config.js';
import { db } from './database/db.js';
import { ALL_COMMANDS } from './commands/index.js';
import { handleButtonInteraction, handleSelectInteraction } from './interactions/handlers.js';
import { handlePrefixMessage } from './commands/prefixHandler.js';
import { deployCommands } from './deploy-commands.js';
import { AiChatService } from './services/aiChat.js';

console.log(`
\x1b[38;2;34;197;94m
  ███████╗███████╗███╗   ██╗ ██████╗ ██╗   ██╗
  ╚══███╔╝██╔════╝████╗  ██║██╔═══██╗╚██╗ ██╔╝
    ███╔╝ █████╗  ██╔██╗ ██║██║   ██║ ╚████╔╝ 
   ███╔╝  ██╔══╝  ██║╚██╗██║██║   ██║  ██╔██╗  
  ███████╗███████╗██║ ╚████║╚██████╔╝ ██╔╝ ██╗ 
  ╚══════╝╚══════╝╚═╝  ╚═══╝ ╚═════╝  ╚═╝  ╚═╝ 
\x1b[0m
  \x1b[90m┌──────────────────────────────────────────────────┐\x1b[0m
  \x1b[90m│\x1b[0m \x1b[32m●\x1b[0m \x1b[1mZenox Cinema Network • Standalone Discord Bot\x1b[0m    \x1b[90m│\x1b[0m
  \x1b[90m│\x1b[0m \x1b[36m⚡ Version:\x1b[0m 2.5.0 | \x1b[35mPure Discord Cinema Edition\x1b[0m       \x1b[90m│\x1b[0m
  \x1b[90m└──────────────────────────────────────────────────┘\x1b[0m
`);

// Initialize Discord Client with MessageContent for custom prefix commands
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Map commands for quick routing
const commandMap = new Collection<string, (interaction: any) => Promise<void>>();
for (const cmd of ALL_COMMANDS) {
  commandMap.set(cmd.data.name, cmd.execute);
}

// Ensure public commands are enabled for @everyone in all channels
async function ensurePublicCommandsUnlocked(c: Client) {
  try {
    if (!CONFIG.GUILD_ID) return;
    const guild = await c.guilds.fetch(CONFIG.GUILD_ID);
    if (!guild) return;

    const me = await guild.members.fetchMe();
    if (!me.permissions.has(PermissionFlagsBits.Administrator) && !me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return;
    }

    const roles = await guild.roles.fetch();
    const everyone = roles.get(guild.id);
    if (everyone && !everyone.permissions.has(PermissionFlagsBits.UseApplicationCommands)) {
      await everyone.setPermissions(everyone.permissions.add(PermissionFlagsBits.UseApplicationCommands));
      console.log('[Zenox Permissions] Enabled UseApplicationCommands on @everyone role.');
    }

    const channels = await guild.channels.fetch();
    for (const [id, ch] of channels) {
      if (!ch) continue;
      const overwrite = ch.permissionOverwrites?.cache?.get(guild.id);
      if (overwrite && overwrite.deny.has(PermissionFlagsBits.UseApplicationCommands)) {
        await ch.permissionOverwrites.edit(guild.id, { UseApplicationCommands: null });
        console.log(`[Zenox Permissions] Cleared command deny on ${ch.name}`);
      }
    }
  } catch (err) {
    console.warn('[Zenox Permissions] Auto-unlock public commands notice:', err);
  }
}

// Event: Ready
client.once(Events.ClientReady, async c => {
  console.log(`\x1b[32m[Zenox Gateway] Logged in as ${c.user.tag}\x1b[0m`);

  // Presence / RPC: "Watching movies & shows on Zenox"
  c.user.setPresence({
    status: 'online',
    activities: [
      {
        name: 'movies & shows on Zenox',
        type: ActivityType.Watching,
        url: 'https://zenox.lol',
      },
    ],
  });

  console.log(`[Zenox Gateway] Presence active: "Watching movies & shows on Zenox"`);

  // Register all 15 commands to Discord Guild
  await deployCommands();

  // Ensure public commands are enabled across all channels for everyone
  await ensurePublicCommandsUnlocked(c);
});

// Process crash guards
process.on('unhandledRejection', reason => {
  console.error('[Zenox Gateway] Handled rejection:', reason);
});
process.on('uncaughtException', error => {
  console.error('[Zenox Gateway] Handled exception:', error);
});

client.on(Events.Error, error => {
  console.error('[Zenox Client Error]', error);
});

// Event: Interaction (Slash commands, buttons, selects)
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const handler = commandMap.get(interaction.commandName);
      if (handler) {
        await handler(interaction);
      } else {
        await interaction.reply({ content: '❌ Unknown command.', flags: MessageFlags.Ephemeral });
      }
    } else if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectInteraction(interaction);
    }
  } catch (error: any) {
    console.error('[Zenox Interaction Error]', error?.message || error);
    if (error?.code === 10062 || error?.code === 40060) return;

    if (interaction.isRepliable()) {
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: '⚠️ An error occurred executing this interaction.', flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: '⚠️ An error occurred executing this interaction.', flags: MessageFlags.Ephemeral });
        }
      } catch {}
    }
  }
});

// Event: Message Create (Prefix commands & AI Chat Mentions)
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  // 1. Process custom prefix commands (e.g. !help, !movie, !status, etc.)
  await handlePrefixMessage(message, client);

  // 2. Mention bot to talk with Zenox AI (if not a prefix command)
  if (client.user && message.mentions.has(client.user) && !message.content.startsWith(db.getPrefix())) {
    try {
      const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
      const cleanPrompt = prompt || 'hello';

      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      const reply = await AiChatService.answer(cleanPrompt, message.author.username);
      await message.reply({ content: reply });
    } catch (err) {
      console.warn('[Zenox Chat Mention Error]', err);
    }
  }
});

// Connect to Discord Gateway
if (CONFIG.DISCORD_TOKEN) {
  client.login(CONFIG.DISCORD_TOKEN).catch(err => {
    console.error('\x1b[31m[Zenox Gateway] Failed to connect with DISCORD_TOKEN:\x1b[0m', err.message);
  });
} else {
  console.warn(`\x1b[33m[Zenox Gateway] WARNING: No DISCORD_TOKEN found in environment variables!\x1b[0m`);
  console.warn(`\x1b[33m[Zenox Gateway] On Render.com: Go to your service Dashboard -> Environment -> Add DISCORD_TOKEN, CLIENT_ID, and GUILD_ID.\x1b[0m`);
}

// Lightweight HTTP server for Render.com & UptimeRobot 24/7 keep-alive
const port = parseInt(process.env.PORT || '10000', 10);
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    const isBotReady = Boolean(client && client.isReady());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'online',
        service: 'Zenox Cinema Discord Bot',
        botReady: isBotReady,
        botTag: client.user ? client.user.tag : 'Connecting...',
        uptimeSeconds: Math.floor(process.uptime()),
        pingMs: client.ws ? client.ws.ping : null,
        platform: 'https://zenox.lol',
      })
    );
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`\x1b[36m[Zenox Keep-Alive] HTTP server listening on 0.0.0.0:${port} for Render & UptimeRobot\x1b[0m`);
});
