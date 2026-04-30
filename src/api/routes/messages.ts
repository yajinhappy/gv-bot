import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import {
  insertMessage,
  getAllMessages,
  getMessageById,
  updateMessage,
  cancelMessageById,
  deleteMessageById,
  markAsSent,
  getMessageStats,
  nowKST,
} from '../../db/schema';

const router = Router();

// ─── 유틸: Base64 이미지를 파일로 저장 ───
function saveImages(images: { name: string; data: string }[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  
  const uploadDir = path.join(__dirname, '../../../data/uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const savedPaths: string[] = [];
  for (const img of images) {
    const base64Data = img.data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const uniqueName = Date.now() + '_' + img.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const filePath = path.join(uploadDir, uniqueName);
    fs.writeFileSync(filePath, buffer);
    savedPaths.push('/uploads/' + uniqueName);
  }
  return savedPaths.join(',');
}

// ─── 입력 검증 스키마 ──────────────────────
const CreateMessageSchema = z.object({
  channelId: z.string().min(1, '채널을 선택해주세요'),
  content: z.string().min(1, '메시지 내용을 입력해주세요').max(4000, '메시지가 너무 깁니다'),
  link: z.string().url().optional().or(z.literal('')),
  images: z.array(z.object({ name: z.string(), data: z.string() })).optional(),
  scheduledAt: z.string().min(1, '예약 시간을 설정해주세요'),
  timezone: z.string().default('GMT+09:00'),
  author: z.string().default('admin'),
});

const SendNowSchema = z.object({
  channelId: z.string().min(1, '채널을 선택해주세요'),
  content: z.string().min(1, '메시지 내용을 입력해주세요').max(4000, '메시지가 너무 깁니다'),
  link: z.string().url().optional().or(z.literal('')),
  images: z.array(z.object({ name: z.string(), data: z.string() })).optional(),
  author: z.string().default('admin'),
});

const UpdateMessageSchema = z.object({
  channelId: z.string().min(1).optional(),
  content: z.string().min(1).max(4000).optional(),
  link: z.string().url().optional().or(z.literal('')).or(z.null()),
  scheduledAt: z.string().optional(),
  timezone: z.string().optional(),
});

// ─── 통계 (순서 중요: /stats/summary가 /:id 보다 먼저) ───
router.get('/stats/summary', (_req: Request, res: Response) => {
  try {
    const stats = getMessageStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: '통계 조회에 실패했습니다.' });
  }
});

// ─── 예약 메시지 목록 조회 ──────────────────
router.get('/', (req: Request, res: Response) => {
  try {
    const { status, channel, search, page = '1', limit = '15' } = req.query;

    const { messages, total } = getAllMessages({
      status: status as string,
      channel: channel as string,
      search: search as string,
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 15,
    });

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 15;

    res.json({
      success: true,
      data: messages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('메시지 목록 조회 실패:', error);
    res.status(500).json({ success: false, error: '메시지 목록 조회에 실패했습니다.' });
  }
});

// ─── 메시지 상세 조회 ──────────────────────
router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '잘못된 ID입니다.' });
    }

    const message = getMessageById(id);
    if (!message) {
      return res.status(404).json({ success: false, error: '메시지를 찾을 수 없습니다.' });
    }

    res.json({ success: true, data: message });
  } catch (error) {
    res.status(500).json({ success: false, error: '메시지 조회에 실패했습니다.' });
  }
});

// ─── 예약 메시지 생성 ──────────────────────
router.post('/', (req: Request, res: Response) => {
  const parsed = CreateMessageSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: '입력값 오류',
      details: parsed.error.format(),
    });
  }

  const { channelId, content, link, images, scheduledAt, timezone, author } = parsed.data;

  try {
    const imageUrl = saveImages(images);

    const id = insertMessage({
      channelId,
      content,
      link: link || null,
      imageUrl: imageUrl,
      scheduledAt,
      timezone,
      author,
    });

    console.log(`📝 예약 등록 [id:${id}] → ${channelId} @ ${scheduledAt}`);

    res.status(201).json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error('메시지 등록 실패:', error);
    res.status(500).json({ success: false, error: '메시지 등록에 실패했습니다.' });
  }
});

// ─── 예약 메시지 수정 ──────────────────────
router.put('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: '잘못된 ID입니다.' });
  }

  const existing = getMessageById(id);
  if (!existing) {
    return res.status(404).json({ success: false, error: '메시지를 찾을 수 없습니다.' });
  }
  if (existing.status !== 'pending') {
    return res.status(400).json({ success: false, error: '대기 상태의 메시지만 수정 가능합니다.' });
  }

  const parsed = UpdateMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: '입력값 오류',
      details: parsed.error.format(),
    });
  }

  try {
    updateMessage({
      id,
      channelId: parsed.data.channelId ?? existing.channel_id,
      content: parsed.data.content ?? existing.content,
      link: parsed.data.link !== undefined ? (parsed.data.link || null) : existing.link,
      scheduledAt: parsed.data.scheduledAt ?? existing.scheduled_at,
      timezone: parsed.data.timezone ?? existing.timezone,
    });

    console.log(`✏️ 예약 수정 [id:${id}]`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: '메시지 수정에 실패했습니다.' });
  }
});

// ─── 예약 메시지 취소 ──────────────────────
router.patch('/:id/cancel', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: '잘못된 ID입니다.' });
  }

  const changes = cancelMessageById(id);

  if (changes === 0) {
    return res.status(404).json({
      success: false,
      error: '취소 불가: 존재하지 않거나 이미 처리된 메시지입니다.',
    });
  }

  console.log(`🚫 예약 취소 [id:${id}]`);
  res.json({ success: true });
});

// ─── 예약 메시지 삭제 ──────────────────────
router.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: '잘못된 ID입니다.' });
  }

  const changes = deleteMessageById(id);

  if (changes === 0) {
    return res.status(404).json({
      success: false,
      error: '삭제 불가: 존재하지 않거나 이미 전송된 메시지입니다.',
    });
  }

  console.log(`🗑️ 메시지 삭제 [id:${id}]`);
  res.json({ success: true });
});

router.post('/send-now', async (req: Request, res: Response) => {
  const parsed = SendNowSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: '입력값 오류',
      details: parsed.error.format(),
    });
  }

  const { channelId, content, link, images, author } = parsed.data;

  try {
    const imageUrl = saveImages(images);
    const now = nowKST();
    const msgId = insertMessage({
      channelId,
      content,
      link: link || null,
      imageUrl: imageUrl,
      scheduledAt: now,
      timezone: 'GMT+09:00',
      author,
    });

    // Discord로 즉시 전송
    const { client } = await import('../../bot/client');
    const { TextChannel, AttachmentBuilder } = await import('discord.js');

    const channelIds = channelId.split(',').map(id => id.trim());

    // 첨부파일 준비
    const discordFiles = [];
    if (images && images.length > 0) {
      for (const img of images) {
        const base64Data = img.data.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        discordFiles.push(new AttachmentBuilder(buffer, { name: img.name }));
      }
    }

    for (const chId of channelIds) {
      const channel = await client.channels.fetch(chId);
      if (channel && channel instanceof TextChannel) {
        let messageContent = content;
        if (link) messageContent += `\n\n🔗 ${link}`;
        await channel.send({ content: messageContent, files: discordFiles });
      }
    }

    markAsSent(msgId);
    console.log(`⚡ 즉시 발송 완료 [id:${msgId}]`);

    res.json({ success: true, data: { id: msgId } });
  } catch (error) {
    console.error('즉시 발송 실패:', error);
    res.status(500).json({ success: false, error: '즉시 발송에 실패했습니다.' });
  }
});

export default router;
