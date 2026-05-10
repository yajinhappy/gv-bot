import { Events, Client } from 'discord.js';
import { client, eventClient } from '../client';
import { startScheduler } from '../../scheduler/scheduler';

let msgReady = false;
let evtReady = false;

function checkBothReady() {
  if (msgReady && evtReady) {
    console.log('✅ 두 봇 모두 준비 완료 — 스케줄러 시작');
    startScheduler();
  }
}

client.once(Events.ClientReady, (c: Client<true>) => {
  console.log(`✅ MSG_PLAY 봇 온라인: ${c.user.tag}`);
  console.log(`📡 MSG_PLAY 연결된 서버 수: ${c.guilds.cache.size}`);
  msgReady = true;
  checkBothReady();
});

eventClient.once(Events.ClientReady, (c: Client<true>) => {
  console.log(`✅ EVENT 봇 온라인: ${c.user.tag}`);
  console.log(`📡 EVENT 연결된 서버 수: ${c.guilds.cache.size}`);
  evtReady = true;
  checkBothReady();
});
