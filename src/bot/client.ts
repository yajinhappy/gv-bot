import { Client, GatewayIntentBits, Collection } from 'discord.js';
import * as dotenv from 'dotenv';

dotenv.config();

// 커맨드 타입 확장
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, SlashCommand>;
  }
}

export interface SlashCommand {
  data: { name: string; description: string; toJSON: () => object };
  execute: (interaction: any) => Promise<void>;
}

// ─── MSG_PLAY 봇 (메시지 예약/발송) ───
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});
client.commands = new Collection();

// ─── EVENT 봇 (이벤트 관리/쿠폰 DM) ───
export const eventClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});
eventClient.commands = new Collection();
