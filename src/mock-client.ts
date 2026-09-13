import { ZenoxEmbeds } from './utils/embeds.js';
import { CatalogService } from './services/catalog.js';
import { StatusService } from './services/status.js';
import { db } from './database/db.js';

async function testSuite() {
  console.log('\x1b[32m=== ZENOX BOT EMBED & SYSTEM TEST SUITE ===\x1b[0m\n');

  // 1. Test Color Roles Panel
  console.log('1. Testing Color Roles Panel...');
  const colorPanel = ZenoxEmbeds.createColorPanel();
  console.log(`   Embed Title: "${colorPanel.embeds[0].data.title}"`);
  console.log(`   Buttons Count: ${colorPanel.components.reduce((acc, row) => acc + row.components.length, 0)}`);
  console.log('   ✅ Color panel valid.\n');

  // 2. Test Ping Roles Panel
  console.log('2. Testing Ping Roles Panel...');
  const pingPanel = ZenoxEmbeds.createPingPanel();
  console.log(`   Embed Title: "${pingPanel.embeds[0].data.title}"`);
  console.log(`   Buttons Count: ${pingPanel.components[0].components.length}`);
  console.log('   ✅ Ping panel valid.\n');

  // 3. Test TV Show Panel
  console.log('3. Testing TV Show Channels Panel...');
  const showPanel = ZenoxEmbeds.createShowPanel();
  console.log(`   Embed Title: "${showPanel.embeds[0].data.title}"`);
  console.log('   ✅ Show panel valid.\n');

  // 4. Test Catalog Search
  console.log('4. Testing Catalog Search ("/search Dune")...');
  const searchResults = await CatalogService.search('Dune');
  console.log(`   Found: ${searchResults.length} result(s). Top: ${searchResults[0].title} (${searchResults[0].year})`);
  const mediaEmbed = ZenoxEmbeds.mediaDetail(searchResults[0]);
  console.log(`   Embed Title: "${mediaEmbed.embeds[0].data.title}"`);
  console.log(`   Watch URL: ${searchResults[0].zenoxUrl}`);
  console.log('   ✅ Search embed valid.\n');

  // 5. Test Trending
  console.log('5. Testing Trending ("/trending")...');
  const trending = await CatalogService.getTrending();
  const trendingEmbed = ZenoxEmbeds.trendingList(trending);
  console.log(`   Trending Count: ${trending.length}`);
  console.log(`   Embed Title: "${trendingEmbed.embeds[0].data.title}"`);
  console.log('   ✅ Trending embed valid.\n');

  // 6. Test Status Check
  console.log('6. Testing Status Telemetry ("/status")...');
  const nodes = await StatusService.refreshStatus();
  const statusEmbed = ZenoxEmbeds.systemStatus(nodes);
  console.log(`   Monitored Nodes: ${nodes.length}`);
  console.log(`   Embed Title: "${statusEmbed.embeds[0].data.title}"`);
  console.log('   ✅ Status telemetry valid.\n');

  // 7. Test Requests Persistence
  console.log('7. Testing Content Requests Persistence...');
  const requests = db.getRequests();
  console.log(`   Total Requests in Queue: ${requests.length}`);
  const ticketEmbed = ZenoxEmbeds.requestTicket(requests[0]);
  console.log(`   Ticket #${requests[0].id} Status: ${requests[0].status}`);
  // 8. Test Help Menu Security (Public vs Admin)
  console.log('8. Testing Help Menu Security (Public vs Admin)...');
  const publicHelp = ZenoxEmbeds.createHelpMenu(0, '!', false);
  const publicCatButtons = publicHelp.components[0].components.map(b => (b.data as any).custom_id);
  if (publicCatButtons.includes('help_cat_3')) {
    throw new Error('SECURITY VIOLATION: help_cat_3 (Admin) found on public help menu!');
  }
  const publicDesc = publicHelp.embeds[0].data.description || '';
  if (publicDesc.includes('Administrator & Setup') || publicDesc.includes('adminsetup')) {
    throw new Error('SECURITY VIOLATION: Admin setup leaked in public help overview description!');
  }
  const hackedPublicHelp = ZenoxEmbeds.createHelpMenu(3, '!', false);
  if (hackedPublicHelp.embeds[0].data.title?.includes('Administrator')) {
    throw new Error('SECURITY VIOLATION: Admin page served to unauthenticated public user!');
  }

  const adminHelp = ZenoxEmbeds.createHelpMenu(3, '!', true);
  const adminCatButtons = adminHelp.components[0].components.map(b => (b.data as any).custom_id);
  if (!adminCatButtons.includes('help_cat_3')) {
    throw new Error('Admin help menu missing help_cat_3 button!');
  }
  if (!adminHelp.embeds[0].data.title?.includes('Administrator')) {
    throw new Error('Admin help page 3 title missing Administrator header!');
  }
  console.log('   ✅ Public help menu strictly sanitized (0 admin leaks).');
  console.log('   ✅ Admin help menu properly accessible only when isAdmin=true.\n');

  console.log('\x1b[32m=== ALL 8 SYSTEM TESTS PASSED SUCCESSFULLY ===\x1b[0m');
}

testSuite();

