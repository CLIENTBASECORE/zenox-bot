import { CatalogService } from './catalog.js';
import { CONFIG } from '../config.js';

export class AiChatService {
  /**
   * Generates a conversational, cinema-savvy reply as Zenox AI Assistant
   */
  public static async answer(prompt: string, userTag?: string): Promise<string> {
    const p = prompt.trim().toLowerCase();
    const userMention = userTag ? `@${userTag}` : 'friend';

    // 1. Greetings & Identity
    if (/^(hi|hello|hey|yo|sup|greet|gm|gn)\b/.test(p)) {
      const greetings = [
        `Hey ${userMention}! 🍿 What are we watching tonight? Ask me for recommendations, or run \`/trending\` to check today's top streams on **zenox.lol**!`,
        `Greetings ${userMention}! Zenox Cinema AI online and standing by. Need a movie pick or looking for a specific series? Just ask!`,
        `Yo ${userMention}! Ready to dive into some cinema? Tell me your favorite genre or mood and I'll find something fire for you on **zenox.lol**!`,
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }

    if (/who (are you|made you|created you)|what are you/i.test(p)) {
      return (
        `🎬 **I am Zenox** — your official cinema AI assistant and Discord concierge for [**zenox.lol**](https://zenox.lol)!\n\n` +
        `I help the community discover 4K movies & series, host synced watch parties, dispatch custom server roles, and handle catalog media requests.\n\n` +
        `Try asking me things like:\n` +
        `• *"Recommend me a sci-fi thriller"*\n` +
        `• *"Is Dune on Zenox?"*\n` +
        `• *"How do I request a movie?"*`
      );
    }

    // 2. Help / How-to commands
    if (/how (to|do i) request|request (movie|show|series)/i.test(p)) {
      return (
        `🍿 **How to Request Titles on Zenox:**\n` +
        `1. Run \`/request title:[name] type:[movie/tv]\` anywhere in the server.\n` +
        `2. Our automated cinema resolver forwards your ticket to staff for review.\n` +
        `3. Once approved and added, you'll be pinged right here! You can watch immediately on [**zenox.lol**](https://zenox.lol).`
      );
    }

    if (/color role|roles|name color|how (to|do i) get color/i.test(p)) {
      return (
        `🎨 **Custom Name Colors on Zenox:**\n` +
        `Head over to the server roles channel or ask an admin to deploy the color picker using \`/panel type:colors\`! You can pick from 7 custom neon aesthetics: Pink, Purple, Blue, Green, Orange, Yellow, or Red.`
      );
    }

    if (/watch ?party|how to host/i.test(p)) {
      return (
        `🍿 **Hosting a Community Watch Party:**\n` +
        `Use \`/watchparty title:[Movie Name] link:[zenox.lol stream link] minutes_from_now:[e.g. 15]\`.\n` +
        `This spawns an RSVP countdown card in chat where members can reserve seats and get alerted at showtime!`
      );
    }

    if (/domain|mirror|blocked|isp|url|link|website/i.test(p) && !p.includes('recommend')) {
      return (
        `🌐 **Official Zenox Streaming Mirrors:**\n` +
        `• **Official Platform**: [https://zenox.lol](https://zenox.lol)\n` +
        `• **Direct Edge CDN**: [https://stream.zenox.lol](https://stream.zenox.lol)\n` +
        `• **Anti-ISP DNS Gateway**: [https://proxy.zenox.lol](https://proxy.zenox.lol)\n\n` +
        `Bookmark these or run \`/domain\` to get the full mirror roster anytime.`
      );
    }

    // 3. Movie Recommendations by Genre
    if (/recommend|what should i watch|give me a (movie|show|series)|suggest/i.test(p)) {
      let genre = '';
      if (/horror|scary|thriller|spooky/i.test(p)) genre = 'Horror/Thriller';
      else if (/sci-?fi|space|cyberpunk|future/i.test(p)) genre = 'Sci-Fi';
      else if (/comedy|funny|laugh/i.test(p)) genre = 'Comedy';
      else if (/action|fight|war/i.test(p)) genre = 'Action';
      else if (/anime|animation/i.test(p)) genre = 'Animation/Anime';

      const randomItem = await CatalogService.getRandom(undefined, genre || undefined);

      if (genre) {
        return (
          `🔥 **Zenox Cinema Recommendation (${genre}):**\n\n` +
          `Check out **${randomItem.title}** (${randomItem.year}) — rated ⭐ **${randomItem.rating}/10**!\n` +
          `*${randomItem.overview.slice(0, 180)}...*\n\n` +
          `Quality: \`${randomItem.quality}\` | Stream now on [**zenox.lol**](${randomItem.zenoxUrl})! 🍿\n` +
          `Want more? Run \`/random\` or \`/trending\`!`
        );
      }

      return (
        `🎬 **Tonight's Zenox Staff Pick:**\n\n` +
        `**${randomItem.title}** (${randomItem.year}) — ⭐ **${randomItem.rating}/10**\n` +
        `*${randomItem.overview.slice(0, 160)}...*\n\n` +
        `Genres: \`${randomItem.genres.join(', ')}\`\n` +
        `▶ **Stream in 4K HDR**: [Watch on Zenox](${randomItem.zenoxUrl})\n\n` +
        `You can also run \`/random\` for instant rolls or \`/trending\` for what's hot today!`
      );
    }

    // 4. Movie Jokes / Fun
    if (/joke|tell me a joke|make me laugh/i.test(p)) {
      const jokes = [
        `Why did the movie star go to the dentist? To get their Hollywood smile polished before premiering on **zenox.lol**! 😂`,
        `Why don't movies like playing hide and seek? Because good plots are always giving themselves away! 🍿`,
        `What is an astronaut's favorite key on the keyboard? The Space bar... perfect for pausing Interstellar on **zenox.lol**! 🚀`,
      ];
      return jokes[Math.floor(Math.random() * jokes.length)];
    }

    // 5. Search check: If user mentions a movie name or asks "is X on zenox"
    const searchMatch = p.match(/(?:is|can i watch|search for|find|about)\s+([a-zA-Z0-9\s:_-]{2,30})/i);
    const candidate = searchMatch ? searchMatch[1].trim() : prompt.trim();

    if (candidate && candidate.length >= 2 && candidate.length <= 40 && !p.includes('how ') && !p.includes('what ')) {
      try {
        const searchResults = await CatalogService.search(candidate);
        if (searchResults && searchResults.length > 0) {
          const item = searchResults[0];
          return (
            `🍿 Found **${item.title}** (${item.year}) on Zenox!\n\n` +
            `• **Rating**: ⭐ \`${item.rating}/10\` (${item.votes.toLocaleString()} votes)\n` +
            `• **Genres**: \`${item.genres.join(', ')}\`\n` +
            `• **Overview**: *${item.overview.slice(0, 180)}...*\n\n` +
            `▶ **Instant Stream (4K HDR)**: [Watch on Zenox](${item.zenoxUrl})\n` +
            `Run \`/search ${item.title}\` for full poster art and metadata!`
          );
        }
      } catch {}
    }

    // 6. Default engaging response
    return (
      `🎬 **Zenox Cinema Concierge:**\n` +
      `I hear you! Whether you're hunting for a late-night thriller, planning a watch party, or looking for high-bitrate 4K streaming, [**zenox.lol**](https://zenox.lol) has you covered.\n\n` +
      `• Need ideas? Try asking: *"Recommend an action movie"* or run \`/trending\`\n` +
      `• Want a specific title? Try \`/search [title]\`\n` +
      `• Missing something in our library? Use \`/request\`!`
    );
  }
}
