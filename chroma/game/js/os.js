// ===== BrowserOS Core =====
const OS = {
    windows: [],
    windowIdCounter: 0,
    zIndexCounter: 100,
    activeWindow: null,
    startMenuOpen: false,

    init() {
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);

        // Boot sequence
        setTimeout(() => {
            document.getElementById('boot-screen').classList.add('hidden');
            document.getElementById('login-screen').classList.remove('hidden');
        }, 2500);

        // Login
        document.getElementById('login-btn').addEventListener('click', () => {
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('desktop').classList.remove('hidden');
        });

        // Close start menu on desktop click
        document.getElementById('desktop').addEventListener('click', (e) => {
            if (e.target.id === 'desktop' || e.target.id === 'desktop-icons') {
                this.closeStartMenu();
            }
        });

        // Right-click context menu
        document.getElementById('desktop').addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e.clientX, e.clientY);
        });

        // Close context menu on click
        document.addEventListener('click', () => {
            const ctx = document.querySelector('.context-menu');
            if (ctx) ctx.remove();
        });
    },

    updateClock() {
        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const date = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        document.getElementById('taskbar-clock').innerHTML = `${time}<br>${date}`;
    },

    toggleStartMenu() {
        this.startMenuOpen = !this.startMenuOpen;
        const menu = document.getElementById('start-menu');
        const btn = document.getElementById('start-btn');
        menu.classList.toggle('hidden', !this.startMenuOpen);
        btn.classList.toggle('active', this.startMenuOpen);
    },

    closeStartMenu() {
        this.startMenuOpen = false;
        document.getElementById('start-menu').classList.add('hidden');
        document.getElementById('start-btn').classList.remove('active');
    },

    openApp(appName) {
        // Check if already open
        const existing = this.windows.find(w => w.appName === appName && !w.minimized);
        if (existing) {
            this.focusWindow(existing.id);
            return;
        }

        const id = ++this.windowIdCounter;
        const windowData = this.createWindow(appName, id);
        this.windows.push(windowData);
        this.addTaskbarApp(appName, id);
        this.focusWindow(id);
    },

    createWindow(appName, id) {
        const container = document.getElementById('windows-container');
        const titles = {
            'notepad': 'Notepad',
            'flight-sim': 'Flight Simulator',
            'snake': 'Snake Game',
            'car-game': 'Car Game',
            'about': 'About BrowserOS'
        };

        const w = 700, h = 500;
        const x = 80 + (id % 5) * 30;
        const y = 40 + (id % 5) * 30;

        const win = document.createElement('div');
        win.className = 'window';
        win.id = `window-${id}`;
        win.style.width = w + 'px';
        win.style.height = h + 'px';
        win.style.left = x + 'px';
        win.style.top = y + 'px';
        win.style.zIndex = ++this.zIndexCounter;

        win.innerHTML = `
            <div class="window-header">
                <span class="window-title">${titles[appName] || appName}</span>
                <div class="window-controls">
                    <button class="btn-minimize" onclick="OS.minimizeWindow(${id})"></button>
                    <button class="btn-maximize" onclick="OS.maximizeWindow(${id})"></button>
                    <button class="btn-close" onclick="OS.closeWindow(${id})"></button>
                </div>
            </div>
            <div class="window-body" id="window-body-${id}"></div>
            <div class="window-resize"></div>
        `;

        container.appendChild(win);

        // Make draggable
        this.makeDraggable(win, id);
        this.makeResizable(win, id);

        // Focus on click
        win.addEventListener('mousedown', () => this.focusWindow(id));

        // Initialize app content
        this.initAppContent(appName, id);

        return { id, appName, minimized: false, maximized: false, element: win };
    },

    initAppContent(appName, id) {
        const body = document.getElementById(`window-body-${id}`);
        switch (appName) {
            case 'notepad': Notepad.init(id, body); break;
            case 'flight-sim': FlightSim.init(id, body); break;
            case 'snake': Snake.init(id, body); break;
            case 'car-game': CarGame.init(id, body); break;
            case 'about': this.initAbout(id, body); break;
        }
    },

    initAbout(id, body) {
        body.innerHTML = `
            <div class="about-content">
                <h1>BrowserOS</h1>
                <p class="version">Version 1.0.0</p>
                <ul class="features">
                    <li>Draggable & resizable windows</li>
                    <li>Start menu with app launcher</li>
                    <li>Taskbar with clock</li>
                    <li>Notepad text editor</li>
                    <li>Flight Simulator game</li>
                    <li>Classic Snake game</li>
                    <li>Racing Car game</li>
                    <li>Right-click context menu</li>
                    <li>Minimize, maximize, close windows</li>
                    <li>Boot & login screens</li>
                </ul>
            </div>
        `;
    },

    makeDraggable(win, id) {
        const header = win.querySelector('.window-header');
        let isDragging = false, startX, startY, origX, origY;

        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            const winData = this.windows.find(w => w.id === id);
            if (winData && winData.maximized) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            origX = win.offsetLeft;
            origY = win.offsetTop;
            header.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            win.style.left = (origX + e.clientX - startX) + 'px';
            win.style.top = (origY + e.clientY - startY) + 'px';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'move';
        });
    },

    makeResizable(win, id) {
        const handle = win.querySelector('.window-resize');
        let isResizing = false, startX, startY, origW, origH;

        handle.addEventListener('mousedown', (e) => {
            const winData = this.windows.find(w => w.id === id);
            if (winData && winData.maximized) return;
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            origW = win.offsetWidth;
            origH = win.offsetHeight;
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const newW = Math.max(400, origW + e.clientX - startX);
            const newH = Math.max(300, origH + e.clientY - startY);
            win.style.width = newW + 'px';
            win.style.height = newH + 'px';
        });

        document.addEventListener('mouseup', () => { isResizing = false; });
    },

    focusWindow(id) {
        const winData = this.windows.find(w => w.id === id);
        if (!winData) return;
        winData.element.style.zIndex = ++this.zIndexCounter;
        this.activeWindow = id;
        winData.minimized = false;
        winData.element.classList.remove('hidden');

        // Update taskbar
        document.querySelectorAll('.taskbar-app').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.windowId) === id);
        });
    },

    minimizeWindow(id) {
        const winData = this.windows.find(w => w.id === id);
        if (!winData) return;
        winData.minimized = true;
        winData.element.classList.add('hidden');
    },

    maximizeWindow(id) {
        const winData = this.windows.find(w => w.id === id);
        if (!winData) return;
        winData.maximized = !winData.maximized;
        winData.element.classList.toggle('maximized', winData.maximized);
    },

    closeWindow(id) {
        const idx = this.windows.findIndex(w => w.id === id);
        if (idx === -1) return;
        const winData = this.windows[idx];

        // Stop any running game (pass the window id so apps can cleanup instance-specific handlers)
        if (winData.appName === 'flight-sim') FlightSim.stop(winData.id);
        if (winData.appName === 'snake') Snake.stop(winData.id);
        if (winData.appName === 'car-game') CarGame.stop(winData.id);

        winData.element.remove();
        this.windows.splice(idx, 1);
        this.removeTaskbarApp(id);
    },

    addTaskbarApp(appName, id) {
        const titles = {
            'notepad': 'Notepad',
            'flight-sim': 'Flight Sim',
            'snake': 'Snake',
            'car-game': 'Car Game',
            'about': 'About'
        };
        const btn = document.createElement('button');
        btn.className = 'taskbar-app active';
        btn.dataset.windowId = id;
        btn.textContent = titles[appName] || appName;
        btn.onclick = () => {
            const winData = this.windows.find(w => w.id === id);
            if (winData.minimized) {
                this.focusWindow(id);
            } else if (this.activeWindow === id) {
                this.minimizeWindow(id);
            } else {
                this.focusWindow(id);
            }
        };
        document.getElementById('taskbar-apps').appendChild(btn);
    },

    removeTaskbarApp(id) {
        const btn = document.querySelector(`.taskbar-app[data-window-id="${id}"]`);
        if (btn) btn.remove();
    },

    showContextMenu(x, y) {
        const ctx = document.createElement('div');
        ctx.className = 'context-menu';
        ctx.style.left = x + 'px';
        ctx.style.top = y + 'px';
        ctx.innerHTML = `
            <div class="context-menu-item" onclick="OS.openApp('notepad'); this.parentElement.remove();">📝 New Notepad</div>
            <div class="context-menu-item" onclick="OS.openApp('snake'); this.parentElement.remove();">🐍 Snake Game</div>
            <div class="context-menu-item" onclick="OS.openApp('flight-sim'); this.parentElement.remove();">✈️ Flight Simulator</div>
            <div class="context-menu-item" onclick="OS.openApp('car-game'); this.parentElement.remove();">🏎️ Car Game</div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" onclick="location.reload(); this.parentElement.remove();">🔄 Refresh</div>
        `;
        document.body.appendChild(ctx);
    },

    shutdown() {
        this.closeStartMenu();
        document.getElementById('desktop').style.transition = 'opacity 1s';
        document.getElementById('desktop').style.opacity = '0';
        setTimeout(() => {
            document.body.innerHTML = '<div style="position:fixed;inset:0;background:#000;display:flex;align-items:center;justify-content:center;color:#333;font-family:sans-serif;font-size:1.2rem;">System shutdown. Refresh to restart.</div>';
        }, 1000);
    }
};

// Initialize OS when DOM is ready
document.addEventListener('DOMContentLoaded', () => OS.init());
