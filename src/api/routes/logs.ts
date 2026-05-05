import { Router, Request, Response } from 'express';
import {
  getActivityLogs,
  getActivityLogTitles,
} from '../../db/schema';

const router = Router();

// ─── 활동 로그 목록 조회 ──────────────────────────
router.get('/', (req: Request, res: Response) => {
  try {
    const {
      actionType,
      loginId,
      targetTitle,
      dateFrom,
      dateTo,
      page = '1',
      limit = '15',
    } = req.query;

    const { logs, total } = getActivityLogs({
      actionType: actionType as string,
      loginId: loginId as string,
      targetTitle: targetTitle as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 15,
    });

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 15;

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('활동 로그 조회 실패:', error);
    res.status(500).json({ success: false, error: '활동 로그 조회에 실패했습니다.' });
  }
});

// ─── 대상 타이틀 목록 (필터 드롭다운용) ──────────────────────────
router.get('/titles', (_req: Request, res: Response) => {
  try {
    const titles = getActivityLogTitles();
    res.json({ success: true, data: titles });
  } catch (error) {
    res.status(500).json({ success: false, error: '타이틀 목록 조회에 실패했습니다.' });
  }
});

export default router;
