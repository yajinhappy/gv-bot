import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import { TextChannel, EmbedBuilder } from 'discord.js';
import { client, eventClient } from '../bot/client';
import { getPendingMessages, markAsSent, markAsFailed, getDb, saveDatabase, nowKST } from '../db/schema';

/**
 * 1분마다 DB를 폴링해서 전송할 예약 메시지가 있으면 Discord로 전송
 */
export function startScheduler() {
  cron.schedule('* * * * *', async () => {
    try { await processPendingMessages(); } catch (e) { console.error('⚠️ 스케줄러 오류 (메시지):', e); }
    try { await processEventStartAnnouncements(); } catch (e) { console.error('⚠️ 스케줄러 오류 (이벤트 공지):', e); }
    try { await processDailyEvents(); } catch (e) { console.error('⚠️ 스케줄러 오류 (데일리):', e); }
    try { await processEventEndNotifications(); } catch (e) { console.error('⚠️ 스케줄러 오류 (종료 알림):', e); }
  });

  console.log('⏰ 메시지 및 이벤트 스케줄러 시작 (1분 주기 폴링)');
}

async function processPendingMessages() {
  const pendingMessages = getPendingMessages();

  if (pendingMessages.length === 0) return;

  console.log(`📨 예약 메시지 처리: ${pendingMessages.length}건`);

  for (const msg of pendingMessages) {
    try {
      await sendScheduledMessage(msg);
      markAsSent(msg.id);
      console.log(`✅ 전송 완료 [id:${msg.id}] → 채널: ${msg.channel_id}`);

      // 발송 완료 시 DM 알림
      if (msg.user_id) {
        try {
          const user = await client.users.fetch(msg.user_id);
          await user.send(`✅ **예약 발송 완료**\n\n예약 #${msg.id}이(가) 정상 발송되었습니다.\n📢 채널: <#${msg.channel_id}>\n⏰ 발송 시간: ${new Date().toLocaleString('ko-KR')}`);
        } catch { /* DM 실패 무시 */ }
      }
    } catch (error) {
      console.error(`❌ 전송 실패 [id:${msg.id}]:`, error);
      markAsFailed(msg.id);
    }
  }
}

async function sendScheduledMessage(msg: any) {
  const channelIds = msg.channel_id.split(',').map((id: string) => id.trim());

  for (const channelId of channelIds) {
    const channel = await client.channels.fetch(channelId);

    if (!channel || !(channel instanceof TextChannel)) {
      console.warn(`⚠️ 채널을 찾을 수 없거나 텍스트 채널이 아님: ${channelId}`);
      continue;
    }

    let messageContent = msg.content;

    // 링크 추가
    if (msg.link) {
      messageContent += `\n\n🔗 ${msg.link}`;
    }

    // 이미지 + 클릭 URL → 임베드
    const imageFiles = msg.image_url ? msg.image_url.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0) : [];
    
    // DB에 저장된 웹 경로(/uploads/...)를 로컬 파일 경로로 변환
    // process.cwd() 사용: Railway 등 프로덕션 환경에서 __dirname은 dist/ 하위를 가리키므로 불안정
    const localImageFiles = imageFiles.map((url: string) => {
      const filename = url.split(/[\\/]/).pop() || '';
      return path.join(process.cwd(), 'data/uploads', filename);
    }).filter((filePath: string) => {
      const exists = fs.existsSync(filePath);
      if (!exists) {
        console.warn(`⚠️ 이미지 파일 없음: ${filePath}`);
      }
      return exists;
    });

    if (localImageFiles.length > 0 && msg.click_url) {
      const imgEmbed = new EmbedBuilder()
        .setDescription(messageContent)
        .setImage(`attachment://${localImageFiles[0].split(/[\\/]/).pop()}`)
        .setURL(msg.click_url);
      await channel.send({ embeds: [imgEmbed], files: [localImageFiles[0]] });
    } else if (localImageFiles.length > 0) {
      // 이미지만 → 파일 첨부
      if (messageContent.length > 2000) {
        const chunks = splitMessage(messageContent, 2000);
        for (let i = 0; i < chunks.length; i++) {
          if (i === chunks.length - 1) {
            await channel.send({ content: chunks[i], files: localImageFiles });
          } else {
            await channel.send({ content: chunks[i] });
          }
          await sleep(500);
        }
      } else {
        await channel.send({ content: messageContent, files: localImageFiles });
      }
    } else {
      // 텍스트만
      if (messageContent.length > 2000) {
        const chunks = splitMessage(messageContent, 2000);
        for (const chunk of chunks) {
          await channel.send({ content: chunk });
          await sleep(500);
        }
      } else {
        await channel.send({ content: messageContent });
      }
    }

    if (channelIds.length > 1) {
      await sleep(1000);
    }
  }
}

function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = maxLength;
    }
    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function processEventStartAnnouncements() {
  const db = getDb();
  const isoStr = nowKST().substring(0, 16).replace(' ', 'T');

  const results = db.exec(`
    SELECT * FROM events
    WHERE status = 'active'
      AND announce_msg IS NOT NULL
      AND announce_msg != ''
      AND announced = 0
      AND start_date <= ?
      AND end_date >= ?
  `, [isoStr, isoStr]);

  if (!results.length || !results[0].values.length) return;

  const columns = results[0].columns;
  const events = results[0].values.map((row: any[]) => {
    const e: any = {};
    columns.forEach((col, idx) => e[col] = row[idx]);
    return e;
  });

  console.log(`📣 이벤트 시작 공지: ${events.length}건`);

  for (const e of events) {
    try {
      const channelIds = e.channel_id.split(',').map((id: string) => id.trim());
      let firstMessageId: string | null = null;
      for (const channelId of channelIds) {
        const channel = await eventClient.channels.fetch(channelId);
        if (channel && channel instanceof TextChannel) {
          const sent = await channel.send({ content: e.announce_msg });
          if (!firstMessageId) firstMessageId = sent.id;
        }
      }
      db.run('UPDATE events SET announced = 1, announce_message_id = ? WHERE id = ?', [firstMessageId, e.id]);
      saveDatabase();
      console.log(`✅ 이벤트 시작 공지 완료 [${e.title}]`);
    } catch (err) {
      console.error(`❌ 이벤트 시작 공지 실패 [${e.title}]:`, err);
    }
  }
}

async function processDailyEvents() {
  const db = getDb();
  const nowStr = nowKST();
  const isoStr = nowStr.substring(0, 16).replace(' ', 'T');
  const currentTime = nowStr.substring(11, 16);

  const results = db.exec(`
    SELECT * FROM events
    WHERE status = 'active'
      AND daily = 'on'
      AND daily_start = ?
      AND announce_msg IS NOT NULL
      AND announce_msg != ''
      AND start_date <= ?
      AND end_date >= ?
  `, [currentTime, isoStr, isoStr]);

  if (!results.length || !results[0].values.length) return;

  const columns = results[0].columns;
  const events = results[0].values.map((row: any[]) => {
    const e: any = {};
    columns.forEach((col, idx) => e[col] = row[idx]);
    return e;
  });

  console.log(`📣 데일리 이벤트 공지: ${events.length}건`);

  for (const e of events) {
    try {
      const channelIds = e.channel_id.split(',').map((id: string) => id.trim());
      for (const channelId of channelIds) {
        const channel = await eventClient.channels.fetch(channelId);
        if (channel && channel instanceof TextChannel) {
          await channel.send({ content: e.announce_msg });
          console.log(`✅ 데일리 이벤트 공지 완료 [${e.title}] → ${channelId}`);
        }
      }
    } catch (err) {
      console.error(`❌ 데일리 이벤트 공지 실패 [${e.title}]:`, err);
    }
  }
}

async function processEventEndNotifications() {
  const db = getDb();
  const isoStr = nowKST().substring(0, 16).replace(' ', 'T');

  const results = db.exec(`
    SELECT * FROM events
    WHERE status = 'active'
      AND announce_msg IS NOT NULL
      AND announce_msg != ''
      AND end_notified = 0
      AND end_date < ?
  `, [isoStr]);

  if (!results.length || !results[0].values.length) return;

  const columns = results[0].columns;
  const events = results[0].values.map((row: any[]) => {
    const e: any = {};
    columns.forEach((col, idx) => e[col] = row[idx]);
    return e;
  });

  console.log(`🔔 이벤트 종료 알림: ${events.length}건`);

  for (const e of events) {
    try {
      const channelId = e.channel_id.split(',')[0].trim();
      const channel = await eventClient.channels.fetch(channelId);
      if (channel && channel instanceof TextChannel) {
        const announceMsg = e.announce_message_id
          ? await channel.messages.fetch(e.announce_message_id).catch(() => null)
          : null;
        if (announceMsg) {
          await announceMsg.reply(`❌ **${e.title}** 이벤트가 종료되었습니다.`);
        } else {
          await channel.send(`❌ **${e.title}** 이벤트가 종료되었습니다.`);
        }
      }
      db.run('UPDATE events SET end_notified = 1 WHERE id = ?', [e.id]);
      saveDatabase();
      console.log(`✅ 이벤트 종료 알림 완료 [${e.title}]`);
    } catch (err) {
      console.error(`❌ 이벤트 종료 알림 실패 [${e.title}]:`, err);
    }
  }
}
