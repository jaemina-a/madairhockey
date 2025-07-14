const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// 데이터베이스 연결 설정
const dbConfig = {
    host: process.env.DB_HOST || '13.61.196.86',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'airhockey_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// 연결 풀 생성
const pool = mysql.createPool(dbConfig);

// 데이터베이스 초기화
async function initDatabase() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ 데이터베이스 연결 성공');
        connection.release();
    } catch (error) {
        console.error('❌ 데이터베이스 연결 실패:', error);
        throw error;
    }
}

// 유저 관련 함수들
const userService = {
    // 유저 생성
    async createUser(username, password, email = null) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(
            'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
            [username, hashedPassword, email]
        );
        return result.insertId;
    },

    // 유저 인증
    async verifyUser(username, password) {
        const [rows] = await pool.execute(
            'SELECT id, username, password_hash FROM users WHERE username = ?',
            [username]
        );
        
        if (rows.length === 0) return null;
        
        const user = rows[0];
        const isValid = await bcrypt.compare(password, user.password_hash);
        
        if (isValid) {
            // 마지막 로그인 시간 업데이트
            await pool.execute(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [user.id]
            );
            return { id: user.id, username: user.username };
        }
        
        return null;
    },

    // 유저 정보 조회
    async getUserById(id) {
        const [rows] = await pool.execute(
            'SELECT id, username, email, created_at, total_games, wins, losses FROM users WHERE id = ?',
            [id]
        );
        return rows[0] || null;
    },

    // 유저 통계 업데이트
    async updateUserStats(userId, isWinner) {
        const updateFields = isWinner 
            ? 'total_games = total_games + 1, wins = wins + 1'
            : 'total_games = total_games + 1, losses = losses + 1';
        
        await pool.execute(
            `UPDATE users SET ${updateFields} WHERE id = ?`,
            [userId]
        );
    }
};

// 스킬 관련 함수들
const skillService = {
    // 유저의 스킬 목록 조회
    async getUserSkills(userId) {
        const [rows] = await pool.execute(`
            SELECT s.*, us.is_unlocked, us.usage_count, us.last_used
            FROM skills s
            LEFT JOIN user_skills us ON s.id = us.skill_id AND us.user_id = ?
            ORDER BY s.id
        `, [userId]);
        
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            icon: row.icon,
            multiplier: parseFloat(row.multiplier),
            color: row.color,
            price: row.price,
            unlock_level: row.unlock_level,
            cooldown: parseFloat(row.cooldown),
            is_unlocked: row.is_unlocked === 1,
            usage_count: row.usage_count || 0,
            last_used: row.last_used
        }));
    },

    // 스킬 사용 기록
    async useSkill(userId, skillId) {
        await pool.execute(`
            UPDATE user_skills 
            SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
            WHERE user_id = ? AND skill_id = ?
        `, [userId, skillId]);
    },

    // 스킬 해금
    async unlockSkill(userId, skillId) {
        await pool.execute(`
            INSERT INTO user_skills (user_id, skill_id, is_unlocked) 
            VALUES (?, ?, TRUE)
            ON DUPLICATE KEY UPDATE is_unlocked = TRUE
        `, [userId, skillId]);
    }
};

// 게임 기록 관련 함수들
const matchService = {
    // 게임 기록 저장
    async saveMatch(player1Id, player2Id, player1Score, player2Score, durationSeconds) {
        const winnerId = player1Score > player2Score ? player1Id : player2Id;
        
        const [result] = await pool.execute(`
            INSERT INTO matches (player1_id, player2_id, player1_score, player2_score, winner_id, duration_seconds)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [player1Id, player2Id, player1Score, player2Score, winnerId, durationSeconds]);
        
        // 유저 통계 업데이트
        await userService.updateUserStats(player1Id, player1Score > player2Score);
        await userService.updateUserStats(player2Id, player2Score > player1Score);
        
        return result.insertId;
    },

    // 유저의 게임 기록 조회
    async getUserMatches(userId, limit = 10) {
        const [rows] = await pool.execute(`
            SELECT m.*, 
                   p1.username as player1_name,
                   p2.username as player2_name
            FROM matches m
            JOIN users p1 ON m.player1_id = p1.id
            JOIN users p2 ON m.player2_id = p2.id
            WHERE m.player1_id = ? OR m.player2_id = ?
            ORDER BY m.created_at DESC
            LIMIT ?
        `, [userId, userId, limit]);
        
        return rows;
    }
};

module.exports = {
    initDatabase,
    userService,
    skillService,
    matchService,
    pool
}; 