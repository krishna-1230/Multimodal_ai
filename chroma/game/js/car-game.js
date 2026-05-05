// ===== Car Racing Game =====
const CarGame = {
    canvas: null,
    ctx: null,
    animFrame: null,
    car: { x: 0, y: 0, width: 40, height: 70 },
    obstacles: [],
    roadLines: [],
    score: 0,
    speed: 3,
    keys: {},
    running: false,
    roadWidth: 300,

    init(id, body) {
        body.innerHTML = `
            <div class="car-game-container">
                <div class="car-game-hud">
                    <div class="hud-item">Score: <span id="car-score-${id}">0</span></div>
                    <div class="hud-item">Speed: <span id="car-speed-${id}">1</span></div>
                    <div class="hud-item">Controls: A/D or ←/→</div>
                    <button class="car-btn" onclick="CarGame.restart(${id})">🔄 Restart</button>
                </div>
                <canvas id="car-canvas-${id}" width="660" height="420"></canvas>
            </div>
        `;
        this.canvas = document.getElementById(`car-canvas-${id}`);
        this.ctx = this.canvas.getContext('2d');
        this.score = 0;
        this.speed = 3;
        this.restart(id);
        this.setupControls();
    },

    restart(id) {
        this.running = true;
        const roadLeft = (this.canvas.width - this.roadWidth) / 2;

        this.car = {
            x: this.canvas.width / 2 - 20,
            y: this.canvas.height - 100,
            width: 40,
            height: 70
        };

        this.obstacles = [];
        this.roadLines = [];
        for (let i = 0; i < 8; i++) {
            this.roadLines.push({ y: i * 60 });
        }

        this.score = 0;
        this.speed = 3;
        this.updateHUD(id);

        if (this.animFrame) cancelAnimationFrame(this.animFrame);
        this.gameLoop(id, 0);
    },

    setupControls() {
        const keyDown = (e) => { this.keys[e.key.toLowerCase()] = true; };
        const keyUp = (e) => { this.keys[e.key.toLowerCase()] = false; };
        document.addEventListener('keydown', keyDown);
        document.addEventListener('keyup', keyUp);
        this.keyDownHandler = keyDown;
        this.keyUpHandler = keyUp;
    },

    gameLoop(id, timestamp) {
        if (!this.running) return;
        this.update(id);
        this.draw(id);
        this.animFrame = requestAnimationFrame((t) => this.gameLoop(id, t));
    },

    update(id) {
        const car = this.car;

        // Car movement
        if ((this.keys['a'] || this.keys['arrowleft']) && car.x > (this.canvas.width - this.roadWidth) / 2) {
            car.x -= 5;
        }
        if ((this.keys['d'] || this.keys['arrowright']) && car.x < (this.canvas.width + this.roadWidth) / 2 - car.width) {
            car.x += 5;
        }

        // Road lines
        this.roadLines.forEach(line => {
            line.y += this.speed;
            if (line.y > this.canvas.height) line.y = -60;
        });

        // Spawn obstacles
        if (Math.random() < 0.02) {
            const roadLeft = (this.canvas.width - this.roadWidth) / 2;
            this.obstacles.push({
                x: roadLeft + Math.random() * (this.roadWidth - 40),
                y: -70,
                width: 40,
                height: 70,
                color: ['#d63031', '#e17055', '#fdcb6e', '#6c5ce7'][Math.floor(Math.random() * 4)]
            });
        }

        // Update obstacles
        this.obstacles.forEach(obs => {
            obs.y += this.speed;
        });

        // Remove off-screen obstacles
        this.obstacles = this.obstacles.filter(obs => obs.y < this.canvas.height + 70);

        // Collision detection
        for (const obs of this.obstacles) {
            if (this.checkCollision(car, obs)) {
                this.gameOver();
                return;
            }
        }

        // Score
        this.score += 1;
        if (this.score % 100 === 0 && this.speed < 10) {
            this.speed += 0.5;
        }
        this.updateHUD(id);
    },

    checkCollision(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    },

    draw(id) {
        const ctx = this.ctx;
        const roadLeft = (this.canvas.width - this.roadWidth) / 2;

        // Grass
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Road
        ctx.fillStyle = '#636e72';
        ctx.fillRect(roadLeft, 0, this.roadWidth, this.canvas.height);

        // Road edges
        ctx.fillStyle = '#fff';
        ctx.fillRect(roadLeft - 5, 0, 5, this.canvas.height);
        ctx.fillRect(roadLeft + this.roadWidth, 0, 5, this.canvas.height);

        // Road lines
        ctx.fillStyle = '#fff';
        this.roadLines.forEach(line => {
            const centerX = this.canvas.width / 2;
            ctx.fillRect(centerX - 2, line.y, 4, 30);
        });

        // Obstacles (other cars)
        this.obstacles.forEach(obs => {
            ctx.fillStyle = obs.color;
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            // Windows
            ctx.fillStyle = '#74b9ff';
            ctx.fillRect(obs.x + 5, obs.y + 10, obs.width - 10, 15);
            ctx.fillRect(obs.x + 5, obs.y + obs.height - 20, obs.width - 10, 10);
        });

        // Player car
        const car = this.car;
        ctx.fillStyle = '#0984e3';
        ctx.fillRect(car.x, car.y, car.width, car.height);
        // Car details
        ctx.fillStyle = '#74b9ff';
        ctx.fillRect(car.x + 5, car.y + 10, car.width - 10, 15);
        ctx.fillRect(car.x + 5, car.y + car.height - 20, car.width - 10, 10);
        // Wheels
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(car.x - 3, car.y + 10, 6, 15);
        ctx.fillRect(car.x + car.width - 3, car.y + 10, 6, 15);
        ctx.fillRect(car.x - 3, car.y + car.height - 25, 6, 15);
        ctx.fillRect(car.x + car.width - 3, car.y + car.height - 25, 6, 15);
    },

    updateHUD(id) {
        document.getElementById(`car-score-${id}`).textContent = this.score;
        document.getElementById(`car-speed-${id}`).textContent = Math.floor(this.speed);
    },

    gameOver() {
        this.running = false;
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = '30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Crash!', this.canvas.width / 2, this.canvas.height / 2 - 20);
        ctx.font = '18px sans-serif';
        ctx.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 20);
    },

    stop() {
        this.running = false;
        if (this.animFrame) cancelAnimationFrame(this.animFrame);
        if (this.keyDownHandler) {
            document.removeEventListener('keydown', this.keyDownHandler);
            document.removeEventListener('keyup', this.keyUpHandler);
        }
    }
};
