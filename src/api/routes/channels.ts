import { Router, Request, Response } from 'express';
import { ChannelType } from 'discord.js';
import { client } from '../../bot/client';

const router = Router();

// 서버의 텍스트 채널 목록 조회 (관리자페이지 채널 선택용)
router.get('/', async (req: Request, res: Response) => {
  try {
    const guildId = process.env.DISCORD_GUILD_ID!;
    const guild = await client.guilds.fetch(guildId);
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

    res.json({ success: true, data: sorted });
  } catch (error) {
    console.error('채널 조회 실패:', error);
    res.status(500).json({ success: false, error: '채널 목록 조회에 실패했습니다.' });
  }
});
// 서버의 역할(Role) 목록 조회
router.get('/roles', async (req: Request, res: Response) => {
  try {
    const guildId = process.env.DISCORD_GUILD_ID!;
    const guild = await client.guilds.fetch(guildId);
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
