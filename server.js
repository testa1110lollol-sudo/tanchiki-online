const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const players = {};
const bullets = [];
const playersPerRoom = {};

function createBullet(x, y, angle, isEnemy = false) {
    const bulletSpeed = 8;
    return {
        id: Math.random().toString(36).substr(2, 9),
        x: x + Math.cos(angle) * 25,
        y: y + Math.sin(angle) * 25,
        vx: Math.cos(angle) * bulletSpeed,
        vy: Math.sin(angle) * bulletSpeed,
        isEnemy,
        createdAt: Date.now()
    };
}

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);
    
    players[socket.id] = {
        id: socket.id,
        x: 450,
        y: 500,
        angle: 0,
        health: 100,
        score: 0,
        color: '#' + Math.floor(Math.random()*16777215).toString(16)
    };
    
    socket.emit('init', { id: socket.id, players, bullets });
    socket.broadcast.emit('playerJoined', players[socket.id]);
    
    socket.on('update', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
            players[socket.id].health = data.health;
            players[socket.id].score = data.score;
            
            socket.broadcast.emit('playerUpdated', players[socket.id]);
        }
    });
    
    socket.on('shoot', (data) => {
        const player = players[socket.id];
        if (player) {
            const bullet = createBullet(player.x, player.y, player.angle);
            bullet.ownerId = socket.id;
            bullets.push(bullet);
            io.emit('bulletCreated', bullet);
        }
    });
    
    socket.on('bulletHit', (data) => {
        const bulletIndex = bullets.findIndex(b => b.id === data.bulletId);
        if (bulletIndex !== -1) {
            bullets.splice(bulletIndex, 1);
            io.emit('bulletRemoved', data.bulletId);
        }
    });
    
    socket.on('playerHit', (data) => {
        if (players[data.targetId]) {
            players[data.targetId].health -= data.damage;
            
            if (players[data.targetId].health <= 0) {
                players[socket.id].score += 10;
                players[data.targetId].x = 450;
                players[data.targetId].y = 500;
                players[data.targetId].health = 100;
            }
            
            io.emit('playerUpdated', players[data.targetId]);
            io.emit('playerUpdated', players[socket.id]);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
    });
});

setInterval(() => {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        
        if (b.x < 0 || b.x > 900 || b.y < 0 || b.y > 600) {
            bullets.splice(i, 1);
            io.emit('bulletRemoved', b.id);
        }
    }
    io.emit('bulletsUpdate', bullets);
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
