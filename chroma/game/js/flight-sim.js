// ===== Flight Simulator App =====
const FlightSim = {
    canvas: null,
    ctx: null,
    animFrame: null,
    plane: { x: 0, y: 0, angle: 0, speed: 2 },
    keys: {},
    clouds: [],
    mountains: [],
    altitude: 0,
    speed: 0,

    init(id, body) {
        body.innerHTML = `
            <div class="flight-sim-container">
                <div class="flight-sim-hud">
                    <div class="hud-item">Altitude: <span id="altitude-${id}">0</span> ft</div>
                    <div class="hud-item">Speed: <span id="speed-${id}">0</span> mph</div>
                    <div class="hud-item">Heading: <span id="heading-${id}">0</span>°</div>
                    <div class="hud-item">Controls: WASD/Arrows</div>
                </div>
                <canvas id="flight-canvas-${id}" width="660" height="420"></canvas>
            </div>
        `;
        this.canvas = document.getElementById(`flight-canvas-${id}`);
        this.ctx = this.canvas.getContext('2d');
        this.plane = { x: this.canvas.width / 2, y: this.canvas.height / 2, angle: 0, speed: 2 };
        this.altitude = 0;
        this.speed = 0;

        // Generate clouds
        this.clouds = [];
        for (let i = 0; i < 20; i++) {
            this.clouds.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: 30 + Math.random() * 50,
                speed: 0.2 + Math.random() * 0.5
            });
        }

        // Generate mountains
        this.mountains = [];
        for (let i = 0; i < 10; i++) {
            this.mountains.push({
                x: Math.random() * this.canvas.width,
                height: 50 + Math.random() * 100,
                width: 80 + Math.random() * 120
            });
        }

        // Keyboard controls
        document.addEventListener('keydown', this.keyDownHandler);
        document.addEventListener('keyup', this.keyUpHandler);

        this.start(id);
    },

    keyDownHandler(e) {
        FlightSim.keys[e.key.toLowerCase()] = true;
    },

    keyUpHandler(e) {
        FlightSim.keys[e.key.toLowerCase()] = false;
    },

    start(id) {
        const loop = () => {
            this.update(id);
            this.draw(id);
            this.animFrame = requestAnimationFrame(loop);
        };
        loop();
    },

    update(id) {
        const p = this.plane;
        if (this.keys['w'] || this.keys['arrowup']) p.angle -= 0.03;
        if (this.keys['s'] || this.keys['arrowdown']) p.angle += 0.03;
        if (this.keys['a'] || this.keys['arrowleft']) p.x -= p.speed;
        if (this.keys['d'] || this.keys['arrowright']) p.x += p.speed;

        // Boundaries
        p.x = Math.max(20, Math.min(this.canvas.width - 20, p.x));
        p.y = Math.max(20, Math.min(this.canvas.height - 20, p.y));

        // Update HUD
        this.altitude = Math.floor(p.y * 10);
        this.speed = Math.floor(p.speed * 50);
        const heading = Math.floor(((p.angle * 180 / Math.PI) % 360 + 360) % 360);
        const altEl = document.getElementById(`altitude-${id}`);
        const speedEl = document.getElementById(`speed-${id}`);
        const headingEl = document.getElementById(`heading-${id}`);
        if (altEl) altEl.textContent = this.altitude;
        if (speedEl) speedEl.textContent = this.speed;
        if (headingEl) headingEl.textContent = heading;
    },

    draw(id) {
        const ctx = this.ctx;
        const p = this.plane;

        // Sky gradient
        const grad = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        grad.addColorStop(0, '#1a1a2e');
        grad.addColorStop(0.5, '#16213e');
        grad.addColorStop(1, '#0f3460');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 50; i++) {
            const sx = (i * 137.5) % this.canvas.width;
            const sy = (i * 73.3) % (this.canvas.height / 2);
            ctx.fillRect(sx, sy, 1, 1);
        }

        // Mountains
        ctx.fillStyle = '#2d3436';
        this.mountains.forEach(m => {
            ctx.beginPath();
            ctx.moveTo(m.x, this.canvas.height);
            ctx.lineTo(m.x + m.width / 2, this.canvas.height - m.height);
            ctx.lineTo(m.x + m.width, this.canvas.height);
            ctx.fill();
        });

        // Clouds
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        this.clouds.forEach(c => {
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
            ctx.arc(c.x + c.size * 0.5, c.y - c.size * 0.2, c.size * 0.7, 0, Math.PI * 2);
            ctx.arc(c.x - c.size * 0.5, c.y - c.size * 0.1, c.size * 0.8, 0, Math.PI * 2);
            ctx.fill();
            c.x -= c.speed;
            if (c.x < -c.size * 2) c.x = this.canvas.width + c.size * 2;
        });

        // Plane
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = '#e17055';
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-15, -10);
        ctx.lineTo(-10, 0);
        ctx.lineTo(-15, 10);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#d63031';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    },

    stop() {
        if (this.animFrame) cancelAnimationFrame(this.animFrame);
        document.removeEventListener('keydown', this.keyDownHandler);
        document.removeEventListener('keyup', this.keyUpHandler);
    }
};
