import { Router, Request, Response } from 'express';
import { client } from '../../bot/client';
import { EmbedBuilder } from 'discord.js';
import { getDb, saveDatabase, nowKST } from '../../db/schema';

const router = Router();

/**
 * POST /api/events/send-coupon-dm
 * 관리 페이지에서 쿠폰 DM 발송 요청
 */
router.post('/send-coupon-dm', async (req: Request, res: Response) => {
  try {
    const { eventTitle, targets } = req.body;

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return res.json({ success: false, error: '발송 대상이 없습니다.' });
    }

    let sentCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const target of targets) {
      try {
        // Discord userId로 유저 조회 — userId가 숫자 ID일 때
        const user = await client.users.fetch(target.userId.replace(/[^0-9]/g, ''));
        if (!user) {
          failCount++;
          errors.push(`${target.userName}: 유저를 찾을 수 없습니다.`);
          continue;
        }

        const dm = await user.createDM();
        const embed = new EmbedBuilder()
          .setTitle('🎁 쿠폰 발급 — ' + (eventTitle || '이벤트'))
          .setDescription(
            `**${target.userName}**님, 이벤트 참여 감사합니다!\n\n` +
            `**쿠폰 코드:** \`${target.couponCode}\`\n\n` +
            `쿠폰 코드를 복사하여 사용해 주세요.`
          )
          .setColor(0x16a34a)
          .setFooter({ text: 'GV DiscordBot Event System' })
          .setTimestamp();

        await dm.send({ embeds: [embed] });
        sentCount++;
      } catch (e: any) {
        failCount++;
        errors.push(`${target.userName}: ${e.message || 'DM 발송 실패'}`);
      }
    }

    return res.json({
      success: true,
      sentCount,
      failCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('쿠폰 DM 발송 API 에러:', err);
    return res.json({ success: false, error: err.message || '서버 오류' });
  }
});

/**
 * GET /api/events
 * 이벤트 목록 조회
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const results = db.exec('SELECT * FROM events ORDER BY created_at DESC');
    if (!results || results.length === 0) {
      return res.json({ success: true, events: [] });
    }
    const cols = results[0].columns;
    const events = results[0].values.map((row: any[]) => {
      const obj: any = {};
      cols.forEach((c: string, i: number) => { obj[c] = row[i]; });
      return obj;
    });
    return res.json({ success: true, events });
  } catch (err: any) {
    return res.json({ success: false, error: err.message });
  }
});

/**
 * POST /api/events
 * 이벤트 등록
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const e = req.body;
    db.run(
      `INSERT INTO events (type, title, description, announce_msg, start_date, end_date, channel_id, command_name, daily, daily_start, daily_end, coupon_method, cpn_type, cpn_code, cpn_stock, cpn_stock_limit, memo, status, author, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        e.type || 'text',
        e.title,
        e.description || null,
        e.announceMsg || null,
        e.startDate,
        e.endDate,
        e.channelId,
        e.commandName || '/이벤트',
        e.daily || 'off',
        e.dailyStart || null,
        e.dailyEnd || null,
        e.couponMethod || 'auto',
        e.cpnType || 'single',
        e.cpnCode || null,
        e.cpnStock || 'unlimited',
        e.cpnStockLimit || 0,
        e.memo || null,
        e.status || 'active',
        e.author || 'admin',
        nowKST(),
      ]
    );
    saveDatabase();
    const result = db.exec('SELECT last_insert_rowid() as id');
    const id = result[0].values[0][0];
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.json({ success: false, error: err.message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = req.params.id;
    const e = req.body;
    db.run(
      `UPDATE events SET
        title = ?, description = ?, announce_msg = ?, start_date = ?, end_date = ?,
        daily = ?, daily_start = ?, daily_end = ?, memo = ?, status = ?
       WHERE id = ?`,
      [
        e.title,
        e.description || null,
        e.announceMsg || null,
        e.startDate,
        e.endDate,
        e.daily || 'off',
        e.dailyStart || null,
        e.dailyEnd || null,
        e.memo || null,
        e.status || 'active',
        id
      ]
    );
    saveDatabase();
    return res.json({ success: true });
  } catch (err: any) {
    return res.json({ success: false, error: err.message });
  }
});

export default router;
