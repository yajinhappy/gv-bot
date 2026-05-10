import { Router, Request, Response } from 'express';
import { ChannelType } from 'discord.js';
import { eventClient } from '../../bot/client';

const router = Router();

// 서버의 텍스트 채널 목록 조회 (관리자페이지 채널 선택용)
router.get('/', async (req: Request, res: Response) => {
  try {
    // Discord 클라이언트 연결 상태 확인
    if (!eventClient.isReady()) {
      console.error('채널 조회 실패: EVENT 봇이 아직 준비되지 않았습니다. (readyAt:', eventClient.readyAt, ')');
      return res.status(503).json({ success: false, error: 'EVENT 봇이 아직 연결 중입니다. 잠시 후 다시 시도해주세요.' });
    }

    const guildId = process.env.DISCORD_GUILD_ID;
    if (!guildId) {
      console.error('채널 조회 실패: DISCORD_GUILD_ID 환경변수가 설정되지 않았습니다.');
      return res.status(500).json({ success: false, error: 'DISCORD_GUILD_ID가 설정되지 않았습니다.' });
    }

    console.log(`채널 조회 시도: guildId=${guildId}, eventClientReady=${eventClient.isReady()}`);
    const guild = await eventClient.guilds.fetch(guildId);
    const channels = await guild.channels.fetch();

    const textChannels = channels
      .filter(ch => ch !== null && ch.type === ChannelType.GuildText)
      .map(ch => ({
        id: ch!.id,
        name: ch!.name,
        type: ch!.type,
      }));

    // 채널 이름 기준 정렬
    const sorted = Array.from(textChannels.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    console.log(`채널 조회 성공: ${sorted.length}개 텍스트 채널 발견`);
    res.json({ success: true, data: sorted });
  } catch (error: any) {
    console.error('채널 조회 실패:', error?.message || error);
    console.error('채널 조회 에러 상세:', error?.stack || '스택 없음');
    const errMsg = error?.message?.includes('Missing Access')
      ? '봇에 서버 채널 접근 권한이 없습니다. 봇의 권한을 확인해주세요.'
      : error?.message?.includes('Unknown Guild')
        ? 'DISCORD_GUILD_ID가 올바르지 않거나 봇이 해당 서버에 참여하지 않았습니다.'
        : '채널 목록 조회에 실패했습니다: ' + (error?.message || '알 수 없는 오류');
    res.status(500).json({ success: false, error: errMsg });
  }
});

// 서버의 역할(Role) 목록 조회
router.get('/roles', async (req: Request, res: Response) => {
  try {
    const guildId = process.env.DISCORD_GUILD_ID!;
    const guild = await eventClient.guilds.fetch(guildId);
    const roles = await guild.roles.fetch();

    const formattedRoles = roles
      .filter(role => role.name !== '@everyone')
      .map(role => ({
        id: role.id,
        name: role.name,
        color: role.hexColor,
      }));

    // 역할 이름 기준 정렬
    const sorted = Array.from(formattedRoles.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    res.json({ success: true, data: sorted });
  } catch (error) {
    console.error('역할 조회 실패:', error);
    res.status(500).json({ success: false, error: '역할 목록 조회에 실패했습니다.' });
  }
});

export default router;
