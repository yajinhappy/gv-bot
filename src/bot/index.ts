import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { REST, Routes } from 'discord.js';
import { client } from './client';
import * as dotenv from 'dotenv';
import { initDatabase } from '../db/schema';
import { startApiServer } from '../api/server';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const GUILD_ID = process.env.DISCORD_GUILD_ID!;

// 커맨드 로드
async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

  const commands = [];

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const fileUrl = pathToFileURL(filePath).href;
    const { default: command } = await import(fileUrl);
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  }

  return commands;
}

// Discord에 슬래시 커맨드 등록
async function registerCommands(commands: object[]) {
  const rest = new REST().setToken(TOKEN);

  console.log('🔄 슬래시 커맨드 등록 중...');
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log('✅ 슬래시 커맨드 등록 완료');
}

// 이벤트 핸들러 로드
async function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const fileUrl = pathToFileURL(filePath).href;
    await import(fileUrl);
  }
}

// 실행
async function main() {
  console.log('🚀 GV DiscordBot 시작...');

  // DB 초기화 (비동기 — sql.js WASM 로드)
  await initDatabase();

  const commands = await loadCommands();
  await loadEvents();
  await registerCommands(commands);

  // Express API 서버 시작 (관리자페이지 연동)
  startApiServer();

  // 봇 로그인
  await client.login(TOKEN);
}

main().catch(console.error);
