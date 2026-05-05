// ===== Notepad App =====
const Notepad = {
    init(id, body) {
        body.innerHTML = `
            <div class="notepad-container">
                <div class="notepad-toolbar">
                    <button class="notepad-btn" onclick="Notepad.newFile(${id})">📄 New</button>
                    <button class="notepad-btn" onclick="Notepad.saveFile(${id})">💾 Save</button>
                    <button class="notepad-btn" onclick="Notepad.toggleWordWrap(${id})">↩️ Wrap</button>
                    <span class="notepad-status">Lines: <span id="lines-${id}">1</span></span>
                </div>
                <textarea class="notepad-textarea" id="notepad-${id}" placeholder="Start typing..." spellcheck="false"></textarea>
            </div>
        `;
        this.textareas = this.textareas || {};
        this.textareas[id] = document.getElementById(`notepad-${id}`);
        this.wrapEnabled = this.wrapEnabled || {};
        this.wrapEnabled[id] = true;

        // Auto-resize textarea
        const textarea = this.textareas[id];
        textarea.addEventListener('input', () => {
            this.updateLineCount(id);
        });
        textarea.addEventListener('keydown', (e) => {
            // Tab support
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
                this.updateLineCount(id);
            }
            // Ctrl+S to save
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveFile(id);
            }
        });
    },

    updateLineCount(id) {
        const textarea = this.textareas[id];
        const lines = textarea.value.split('\n').length;
        document.getElementById(`lines-${id}`).textContent = lines;
    },

    newFile(id) {
        this.textareas[id].value = '';
        this.updateLineCount(id);
    },

    saveFile(id) {
        const content = this.textareas[id].value;
        const blob = new Blob([content], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'untitled.txt';
        a.click();
        URL.revokeObjectURL(a.href);
    },

    toggleWordWrap(id) {
        this.wrapEnabled[id] = !this.wrapEnabled[id];
        this.textareas[id].style.whiteSpace = this.wrapEnabled[id] ? 'pre-wrap' : 'pre';
        this.textareas[id].style.overflowX = this.wrapEnabled[id] ? 'hidden' : 'auto';
    }
};
