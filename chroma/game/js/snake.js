// ===== Snake Game =====
const Snake = {
    canvas: null,
    ctx: null,
    animFrame: null,
    snake: [],
    food: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    gridSize: 20,
    score: 0,
    gameSpeed: 100,
    lastUpdate: 0,
    running: false,

    init(id, body) {
        const cols = Math.floor(660 / this.gridSize);
        const rows = Math.floor(420 / this.gridSize);

        body.innerHTML = `
            <div class="snake-container">
                <div class="snake-hud">
                    <div class="hud-item">Score: <span id="snake-score-${id}">0</span></div>
                    <div class="hud-item">Speed: <span id="snake-speed-${id}">1</span></div>
                    <div class="hud-item">Controls: Arrow Keys / WASD</div>
                    <button class="snake-btn" onclick="Snake.restart(${id})">🔄 Restart</button>
                </div>
                <canvas id="snake-canvas-${id}" width="${cols * this.gridSize}" height="${rows * this.gridSize}"></canvas>
            </div>
        `;
        this.canvas = document.getElementById(`snake-canvas-${id}`);
        this.ctx = this.canvas.getContext('2d');
        this.score = 0;
        this.gameSpeed = 100;
        this.restart(id);
        this.setupControls(id);
    },

    restart(id) {
        this.running = true;
        const cols = this.canvas.width / this.gridSize;
        const rows = this.canvas.height / this.gridSize;

        // Initialize snake
        this.snake = [
            { x: Math.floor(cols / 2), y: Math.floor(rows / 2) },
            { x: Math.floor(cols / 2) - 1, y: Math.floor(rows / 2) },
            { x: Math.floor(cols / 2) - 2, y: Math.floor(rows / 2) }
        ];
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.score = 0;
        this.gameSpeed = 100;

        this.placeFood();
        this.updateHUD(id);

        if (this.animFrame) cancelAnimationFrame(this.animFrame);
        this.gameLoop(id, 0);
    },

    placeFood() {
        const cols = this.canvas.width / this.gridSize;
        const rows = this.canvas.height / this.gridSize;
        let valid = false;
        while (!valid) {
            this.food = {
                x: Math.floor(Math.random() * cols),
                y: Math.floor(Math.random() * rows)
            };
            valid = !this.snake.some(s => s.x === this.food.x && s.y === this.food.y);
        }
    },

    setupControls(id) {
        const handler = (e) => {
            if (!this.running) return;
            const key = e.key.toLowerCase();
            const d = this.direction;
            if ((key === 'arrowup' || key === 'w') && d.y !== 1) this.nextDirection = { x: 0, y: -1 };
            if ((key === 'arrowdown' || key === 's') && d.y !== -1) this.nextDirection = { x: 0, y: 1 };
            if ((key === 'arrowleft' || key === 'a') && d.x !== 1) this.nextDirection = { x: -1, y: 0 };
            if ((key === 'arrowright' || key === 'd') && d.x !== -1) this.nextDirection = { x: 1, y: 0 };
        };
        document.addEventListener('keydown', handler);
        this.keyHandler = handler;
    },

    gameLoop(id, timestamp) {
        if (!this.running) return;

        if (timestamp - this.lastUpdate > this.gameSpeed) {
            this.update();
            this.lastUpdate = timestamp;
        }

        this.draw(id);
        this.animFrame = requestAnimationFrame((t) => this.gameLoop(id, t));
    },

    update() {
        this.direction = { ...this.nextDirection };
        const head = {
            x: this.snake[0].x + this.direction.x,
            y: this.snake[0].y + this.direction.y
        };

        // Check collision with walls
        const cols = this.canvas.width / this.gridSize;
        const rows = this.canvas.height / this.gridSize;
        if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
            this.gameOver();
            return;
        }

        // Check collision with self
        if (this.snake.some(s => s.x === head.x && s.y === head.y)) {
            this.gameOver();
            return;
        }

        this.snake.unshift(head);

        // Check food
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            if (this.score % 50 === 0 && this.gameSpeed > 50) {
                this.gameSpeed -= 10;
            }
            this.placeFood();
        } else {
            this.snake.pop();
        }
    },

    draw(id) {
        const ctx = this.ctx;
        const gs = this.gridSize;

        // Background
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        for (let x = 0; x <= this.canvas.width; x += gs) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y <= this.canvas.height; y += gs) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }

        // Food
        ctx.fillStyle = '#e17055';
        ctx.beginPath();
        ctx.arc(
            this.food.x * gs + gs / 2,
            this.food.y * gs + gs / 2,
            gs / 2 - 2, 0, Math.PI * 2
        );
        ctx.fill();

        // Snake
        this.snake.forEach((s, i) => {
            const alpha = 1 - (i / this.snake.length) * 0.5;
            ctx.fillStyle = i === 0 ? '#00b894' : `rgba(0, 184, 148, ${alpha})`;
            ctx.fillRect(s.x * gs + 1, s.y * gs + 1, gs - 2, gs - 2);

            // Eyes on head
            if (i === 0) {
                ctx.fillStyle = '#fff';
                const ex = s.x * gs + gs / 2 + this.direction.x * 4;
                const ey = s.y * gs + gs / 2 + this.direction.y * 4;
                ctx.beginPath();
                ctx.arc(ex - 3 * this.direction.y, ey + 3 * this.direction.x, 2, 0, Math.PI * 2);
                ctx.arc(ex + 3 * this.direction.y, ey - 3 * this.direction.x, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    },

    updateHUD(id) {
        document.getElementById(`snake-score-${id}`).textContent = this.score;
        document.getElementById(`snake-speed-${id}`).textContent = Math.floor((100 - this.gameSpeed) / 10) + 1;
    },

    gameOver() {
        this.running = false;
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = '30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over!', this.canvas.width / 2, this.canvas.height / 2 - 20);
        ctx.font = '18px sans-serif';
        ctx.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 20);
    },

    stop() {
        this.running = false;
        if (this.animFrame) cancelAnimationFrame(this.animFrame);
        if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler);
    }
};
