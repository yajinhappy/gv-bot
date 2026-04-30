import cron from 'node-cron';
import { TextChannel, EmbedBuilder } from 'discord.js';
import { client } from '../bot/client';
import { getPendingMessages, markAsSent, markAsFailed } from '../db/schema';

/**
 * 1분마다 DB를 폴링해서 전송할 메시지가 있으면 Discord로 전송
 */
export function startScheduler() {
  cron.schedule('* * * * *', async () => {
    await processPendingMessages();
  });

  console.log('⏰ 메시지 스케줄러 시작 (1분 주기 폴링)');
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
    const imageFiles = msg.image_url ? msg.image_url.split(',') : [];

    if (imageFiles.length > 0 && msg.click_url) {
      const imgEmbed = new EmbedBuilder()
        .setDescription(messageContent)
        .setImage(`attachment://${imageFiles[0].split(/[\\/]/).pop()}`)
        .setURL(msg.click_url);
      await channel.send({ embeds: [imgEmbed], files: [imageFiles[0]] });
    } else if (imageFiles.length > 0) {
      // 이미지만 → 파일 첨부
      if (messageContent.length > 2000) {
        const chunks = splitMessage(messageContent, 2000);
        for (let i = 0; i < chunks.length; i++) {
          if (i === chunks.length - 1) {
            await channel.send({ content: chunks[i], files: imageFiles });
          } else {
            await channel.send({ content: chunks[i] });
          }
          await sleep(500);
        }
      } else {
        await channel.send({ content: messageContent, files: imageFiles });
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
