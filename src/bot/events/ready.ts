import { Events, Client } from 'discord.js';
import { client } from '../client';
import { startScheduler } from '../../scheduler/scheduler';

client.once(Events.ClientReady, (c: Client<true>) => {
  console.log(`✅ 봇 온라인: ${c.user.tag}`);
  console.log(`📡 연결된 서버 수: ${c.guilds.cache.size}`);

  // 봇이 준비되면 스케줄러 시작
  startScheduler();
});
