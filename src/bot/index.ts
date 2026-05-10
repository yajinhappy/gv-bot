// 서버 시간대를 한국(KST)으로 강제 설정 — 반드시 모든 import보다 먼저 실행
process.env.TZ = 'Asia/Seoul';

import * as fs from 'fs';
import * as path from 'path';
import { REST, Routes } from 'discord.js';
import { client, eventClient } from './client';
import * as dotenv from 'dotenv';
import { initDatabase } from '../db/schema';
import { startApiServer } from '../api/server';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const EVENT_BOT_TOKEN = process.env.EVENT_BOT_TOKEN!;
const EVENT_BOT_CLIENT_ID = process.env.EVENT_BOT_CLIENT_ID!;
const GUILD_ID = process.env.DISCORD_GUILD_ID!;

// 이벤트 봇용 커맨드 파일 목록
const EVENT_COMMAND_FILES = ['event_join', 'event_image'];

// 커맨드 로드
async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

  const msgCommands = [];
  const evtCommands = [];

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const commandModule = require(filePath);
    const command = commandModule.default || commandModule;
    const baseName = file.replace(/\.(ts|js)$/, '');

    if (EVENT_COMMAND_FILES.includes(baseName)) {
      // 이벤트 봇용 커맨드
      eventClient.commands.set(command.data.name, command);
      evtCommands.push(command.data.toJSON());
      console.log(`  [EVENT] 커맨드 로드: ${command.data.name}`);
    } else {
      // 메시지 봇용 커맨드
      client.commands.set(command.data.name, command);
      msgCommands.push(command.data.toJSON());
      console.log(`  [MSG_PLAY] 커맨드 로드: ${command.data.name}`);
    }
  }

  return { msgCommands, evtCommands };
}

// Discord에 슬래시 커맨드 등록
async function registerCommands(msgCommands: object[], evtCommands: object[]) {
  // MSG_PLAY 봇 커맨드 등록
  if (msgCommands.length > 0) {
    const msgRest = new REST().setToken(TOKEN);
    console.log(`🔄 MSG_PLAY 봇 슬래시 커맨드 등록 중... (${msgCommands.length}개)`);
    await msgRest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: msgCommands }
    );
    console.log('✅ MSG_PLAY 봇 슬래시 커맨드 등록 완료');
  }

  // EVENT 봇 커맨드 등록
  if (evtCommands.length > 0) {
    const evtRest = new REST().setToken(EVENT_BOT_TOKEN);
    console.log(`🔄 EVENT 봇 슬래시 커맨드 등록 중... (${evtCommands.length}개)`);
    await evtRest.put(
      Routes.applicationGuildCommands(EVENT_BOT_CLIENT_ID, GUILD_ID),
      { body: evtCommands }
    );
    console.log('✅ EVENT 봇 슬래시 커맨드 등록 완료');
  }
}

// 이벤트 핸들러 로드
async function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    require(filePath);
  }
}

// 실행
async function main() {
  console.log('🚀 GV DiscordBot 시작 (두 봇 분리 모드)...');
  console.log(`  MSG_PLAY 봇 Client ID: ${CLIENT_ID}`);
  console.log(`  EVENT 봇 Client ID: ${EVENT_BOT_CLIENT_ID}`);

  // DB 초기화 (비동기 — sql.js WASM 로드)
  await initDatabase();

  const { msgCommands, evtCommands } = await loadCommands();
  await loadEvents();
  await registerCommands(msgCommands, evtCommands);

  // Express API 서버 시작 (관리자페이지 연동)
  startApiServer();

  // 두 봇 동시 로그인
  await Promise.all([
    client.login(TOKEN).then(() => console.log('✅ MSG_PLAY 봇 로그인 완료')),
    eventClient.login(EVENT_BOT_TOKEN).then(() => console.log('✅ EVENT 봇 로그인 완료')),
  ]);
}

main().catch(console.error);
