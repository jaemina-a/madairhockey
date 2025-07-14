require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { initDatabase, userService } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://13.61.196.86:5173',
    credentials: true
}));
app.use(express.json());

// JWT 토큰 검증 미들웨어
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// 회원가입 API
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, password, email } = req.body;
        
        // 입력 검증
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        // 유저 생성
        const userId = await userService.createUser(username, password, email);
        
        res.status(201).json({ 
            message: 'User created successfully',
            userId 
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Username already exists' });
        }
        
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 로그인 API
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // 입력 검증
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        // 유저 인증
        const user = await userService.verifyUser(username, password);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // JWT 토큰 생성
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 유저 정보 조회 API (인증 필요)
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await userService.getUserById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            created_at: user.created_at,
            total_games: user.total_games,
            wins: user.wins,
            losses: user.losses
        });
        
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 토큰 검증 API
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ 
        valid: true, 
        user: req.user 
    });
});

// 회원가입 API (프론트엔드 호환용)
app.post('/api/signup', async (req, res) => {
    try {
        const { username, password, email } = req.body;
        // 입력 검증
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        // 유저 생성
        const userId = await userService.createUser(username, password, email);
        res.status(201).json({ 
            message: 'User created successfully',
            userId 
        });
    } catch (error) {
        console.error('Signup error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 기본 라우트
app.get('/', (req, res) => {
    res.json({ 
        message: 'Air Hockey Game API',
        version: '1.0.0'
    });
});

// 서버 시작
async function startServer() {
    try {
        // 데이터베이스 초기화
        await initDatabase();
        console.log('✅ 데이터베이스 연결 완료');
        
        // 서버 시작
        app.listen(PORT, () => {
            console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다`);
            console.log(`📡 API 엔드포인트: http://localhost:${PORT}`);
        });
        
    } catch (error) {
        console.error('❌ 서버 시작 실패:', error);
        process.exit(1);
    }
}

startServer(); 