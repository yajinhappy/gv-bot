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

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.commands = new Collection();
