import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import {
  findOperatorByLoginId,
  createOperator,
  getAllOperators,
  updateOperatorStatus,
  updateOperatorPassword,
  getOperatorById,
  insertActivityLog,
} from '../../db/schema';

const router = Router();

// IP 주소 추출 헬퍼
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || '-';
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'gv-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '8h';

// ─── 로그인 ──────────────────────────
const LoginSchema = z.object({
  loginId: z.string().min(1, '아이디를 입력해주세요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

router.post('/login', (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: '아이디와 비밀번호를 입력해주세요.' });
  }

  const { loginId, password } = parsed.data;

  try {
    const operator = findOperatorByLoginId(loginId);
    if (!operator) {
      insertActivityLog({
        actionType: '로그인',
        loginId,
        targetTitle: '시스템',
        detail: '존재하지 않는 아이디',
        ipAddress: getClientIp(req),
        result: 'fail',
        resultDetail: '아이디 없음',
      });
      return res.status(401).json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    if (operator.status !== 'approved') {
      const statusMsg: Record<string, string> = {
        pending: '계정 승인 대기 중입니다. 관리자 승인 후 로그인하실 수 있습니다.',
        rejected: '계정 승인이 거절되었습니다. 관리자에게 문의하세요.',
        suspended: '계정이 정지되었습니다. 관리자에게 문의하세요.',
      };
      insertActivityLog({
        actionType: '로그인',
        loginId,
        targetTitle: '시스템',
        detail: statusMsg[operator.status] || '로그인 불가 계정',
        ipAddress: getClientIp(req),
        result: 'fail',
        resultDetail: `계정 상태: ${operator.status}`,
      });
      return res.status(403).json({
        success: false,
        error: statusMsg[operator.status] || '로그인할 수 없는 계정 상태입니다.',
      });
    }

    const isPasswordValid = bcrypt.compareSync(password, operator.password_hash);
    if (!isPasswordValid) {
      insertActivityLog({
        actionType: '로그인',
        loginId,
        targetTitle: '시스템',
        detail: '비밀번호 오류',
        ipAddress: getClientIp(req),
        result: 'fail',
        resultDetail: '비밀번호 오류',
      });
      return res.status(401).json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      {
        id: operator.id,
        loginId: operator.login_id,
        name: operator.name,
        role: operator.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log(`🔐 로그인 성공: ${operator.login_id} (${operator.name})`);

    insertActivityLog({
      actionType: '로그인',
      loginId: operator.login_id,
      targetTitle: '시스템',
      detail: `${operator.name} 로그인 성공`,
      ipAddress: getClientIp(req),
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: operator.id,
          loginId: operator.login_id,
          name: operator.name,
          email: operator.email,
          team: operator.team,
          role: operator.role,
        },
      },
    });
  } catch (error) {
    console.error('로그인 에러:', error);
    res.status(500).json({ success: false, error: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

// ─── 회원가입 (계정 생성 요청) ──────────────────────────
const SignupSchema = z.object({
  loginId: z.string().min(3, '아이디는 3자 이상이어야 합니다').max(30),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다'),
  name: z.string().min(1, '이름을 입력해주세요'),
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  team: z.string().min(1, '팀/유닛명을 입력해주세요'),
  game: z.string().min(1, '담당 게임을 입력해주세요'),
  note: z.string().optional(),
});

router.post('/signup', (req: Request, res: Response) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message || '입력값 오류';
    return res.status(400).json({ success: false, error: firstError });
  }

  const { loginId, password, name, email, team, game, note } = parsed.data;

  try {
    // 중복 아이디 검사
    const existing = findOperatorByLoginId(loginId);
    if (existing) {
      return res.status(409).json({ success: false, error: '이미 사용 중인 아이디입니다.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const id = createOperator({ loginId, passwordHash, name, email, team, game, note });

    console.log(`📝 계정 생성 요청: ${loginId} (${name}) — 승인 대기 중`);

    insertActivityLog({
      actionType: '운영자 등록',
      loginId,
      targetTitle: '시스템',
      detail: `${name} (${team}) 계정 생성 요청`,
      ipAddress: getClientIp(req),
      result: 'success',
    });

    res.status(201).json({
      success: true,
      data: { id },
      message: '계정 생성 요청이 완료되었습니다. 관리자 승인 후 로그인하실 수 있습니다.',
    });
  } catch (error) {
    console.error('회원가입 에러:', error);
    res.status(500).json({ success: false, error: '계정 생성 중 오류가 발생했습니다.' });
  }
});

// ─── 토큰 검증 ──────────────────────────
router.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '인증 토큰이 없습니다.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const operator = getOperatorById(decoded.id);
    if (!operator || operator.status !== 'approved') {
      return res.status(401).json({ success: false, error: '유효하지 않은 토큰입니다.' });
    }

    res.json({
      success: true,
      data: {
        id: operator.id,
        loginId: operator.login_id,
        name: operator.name,
        email: operator.email,
        team: operator.team,
        role: operator.role,
      },
    });
  } catch {
    return res.status(401).json({ success: false, error: '토큰이 만료되었거나 유효하지 않습니다.' });
  }
});

// ─── 비밀번호 변경 ──────────────────────────
const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, '새 비밀번호는 6자 이상이어야 합니다'),
});

router.post('/change-password', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '인증 토큰이 없습니다.' });
  }

  const token = authHeader.split(' ')[1];
  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, error: '토큰이 만료되었거나 유효하지 않습니다.' });
  }

  const parsed = ChangePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message || '입력값 오류' });
  }

  try {
    const operator = getOperatorById(decoded.id);
    if (!operator) {
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
    }

    if (!bcrypt.compareSync(parsed.data.currentPassword, operator.password_hash)) {
      return res.status(400).json({ success: false, error: '현재 비밀번호가 올바르지 않습니다.' });
    }

    const newHash = bcrypt.hashSync(parsed.data.newPassword, 10);
    updateOperatorPassword(operator.id, newHash);

    console.log(`🔑 비밀번호 변경: ${operator.login_id}`);

    insertActivityLog({
      actionType: '비밀번호 변경',
      loginId: operator.login_id,
      targetTitle: '시스템',
      detail: `${operator.name} 비밀번호 변경`,
      ipAddress: getClientIp(req),
      result: 'success',
    });
    res.json({ success: true, message: '비밀번호가 변경되었습니다.' });
  } catch (error) {
    res.status(500).json({ success: false, error: '비밀번호 변경 중 오류가 발생했습니다.' });
  }
});

// ─── 운영자 목록 (관리자 전용) ──────────────────────────
router.get('/operators', (req: Request, res: Response) => {
  try {
    const operators = getAllOperators();
    res.json({ success: true, data: operators });
  } catch (error) {
    res.status(500).json({ success: false, error: '운영자 목록 조회에 실패했습니다.' });
  }
});

// ─── 운영자 승인/거절 (관리자 전용) ──────────────────────────
const StatusUpdateSchema = z.object({
  status: z.enum(['approved', 'rejected', 'suspended']),
});

router.patch('/operators/:id/status', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: '잘못된 ID입니다.' });
  }

  const parsed = StatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: '유효하지 않은 상태값입니다.' });
  }

  try {
    const changes = updateOperatorStatus(id, parsed.data.status);
    if (changes === 0) {
      return res.status(404).json({ success: false, error: '운영자를 찾을 수 없습니다.' });
    }

    const statusLabel: Record<string, string> = {
      approved: '승인',
      rejected: '거절',
      suspended: '정지',
    };
    console.log(`👤 운영자 상태 변경 [id:${id}] → ${statusLabel[parsed.data.status]}`);

    // 요청자 정보 추출
    const authHeader2 = req.headers.authorization;
    let requestLoginId = 'system';
    if (authHeader2 && authHeader2.startsWith('Bearer ')) {
      try {
        const decoded2 = jwt.verify(authHeader2.split(' ')[1], JWT_SECRET) as any;
        requestLoginId = decoded2.loginId || 'system';
      } catch {}
    }
    const targetOp = getOperatorById(id);
    insertActivityLog({
      actionType: '운영자 수정',
      loginId: requestLoginId,
      targetTitle: '시스템',
      detail: `${targetOp?.name || id} 상태 → ${statusLabel[parsed.data.status]}`,
      ipAddress: getClientIp(req),
      result: 'success',
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: '상태 변경에 실패했습니다.' });
  }
});

// ─── 운영자 담당 게임 변경 (관리자 전용) ──────────────────────────
import { updateOperatorGame } from '../../db/schema';

const GameUpdateSchema = z.object({
  game: z.string(),
});

router.patch('/operators/:id/game', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: '잘못된 ID입니다.' });
  }

  const parsed = GameUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: '유효하지 않은 입력값입니다.' });
  }

  try {
    const changes = updateOperatorGame(id, parsed.data.game);
    if (changes === 0) {
      return res.status(404).json({ success: false, error: '운영자를 찾을 수 없습니다.' });
    }

    console.log(`👤 운영자 담당 게임 변경 [id:${id}] → ${parsed.data.game}`);

    const authHeader3 = req.headers.authorization;
    let reqLoginId = 'system';
    if (authHeader3 && authHeader3.startsWith('Bearer ')) {
      try {
        const decoded3 = jwt.verify(authHeader3.split(' ')[1], JWT_SECRET) as any;
        reqLoginId = decoded3.loginId || 'system';
      } catch {}
    }
    const targetOp2 = getOperatorById(id);
    insertActivityLog({
      actionType: '운영자 수정',
      loginId: reqLoginId,
      targetTitle: '시스템',
      detail: `${targetOp2?.name || id} 담당 게임 → ${parsed.data.game}`,
      ipAddress: getClientIp(req),
      result: 'success',
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: '담당 게임 변경에 실패했습니다.' });
  }
});

export default router;
