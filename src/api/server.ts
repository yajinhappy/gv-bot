import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as path from 'path';
import * as dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import messagesRouter from './routes/messages';
import channelsRouter from './routes/channels';
import authRouter from './routes/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? process.env.API_PORT ?? 3001;

// 미들웨어
app.use(cors({
  origin: '*',  // 개발용: 로컬 file:// 프로토콜 허용. 프로덕션에서는 특정 origin으로 제한
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 관리자페이지 정적 파일 서빙 (admin-tool 폴더)
app.use('/admin', express.static(path.join(__dirname, '../../admin-tool')));

// API 인증 미들웨어 (JWT Bearer 또는 API Key 허용)
const JWT_SECRET = process.env.JWT_SECRET ?? 'gv-jwt-secret-change-in-production';

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. JWT Bearer 토큰 확인
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      (req as any).user = decoded;
      return next();
    } catch {
      // JWT 실패 시 API Key로 폴백
    }
  }

  // 2. API Key 확인
  const apiKey = req.headers['x-api-key'];
  if (apiKey === process.env.API_SECRET) {
    return next();
  }

  return res.status(401).json({ success: false, error: 'Unauthorized' });
}

// 라우터
app.use('/api/auth', authRouter);  // 인증 없이 접근 가능
app.use('/api/messages', authMiddleware, messagesRouter);
app.use('/api/channels', authMiddleware, channelsRouter);

// 헬스체크 (인증 불필요)
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 에러 핸들러
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('API 에러:', err);
  res.status(500).json({ success: false, error: '서버 내부 오류' });
});

export function startApiServer() {
  app.listen(PORT, () => {
    console.log(`🚀 API 서버 실행: http://localhost:${PORT}`);
    console.log(`📁 관리자페이지: http://localhost:${PORT}/admin/`);
  });
}

export default app;
