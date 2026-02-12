
let editor;
const userEmail = localStorage.getItem('userEmail');
const explainBtn = document.getElementById('explainBtn');

// 1. FIXED: User Display Logic
const userDisplay = document.getElementById('userDisplay');
if (userDisplay) {
    if (userEmail) {
        // Displays the icon and email from localStorage
        userDisplay.innerHTML = `<span class="user-avatar">👤</span> User: ${userEmail}`;
    } else {
        userDisplay.innerHTML = `<span class="user-avatar">⚠️</span> Not logged in`;
    }
}
// Toast Notification System
function showNotification(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return; // Guard clause if container is missing
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// 2. Initialize Monaco Editor
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs' }});
require(['vs/editor/editor.main'], function() {
    editor = monaco.editor.create(document.getElementById('editorContainer'), {
        value: "// Paste your code here...\n// Example: console.log('Hello World!');",
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 14,
        fontFamily: 'JetBrains Mono, monospace',
        minimap: { enabled: false },
        padding: { top: 20 }
    });
});

// 3. Clear Editor Functionality (Fixes the Top-Right Button)
const clearEditorBtn = document.getElementById('clearEditorBtn');
if (clearEditorBtn) {
    clearEditorBtn.addEventListener('click', () => {
        if (confirm("🧹 Clear all code from the editor?")) {
            editor.setValue("");
            showNotification('Editor cleared', 'info');
            editor.focus();
        }
    });
}

// 4. Style Selector Logic (Updates hints based on selection)
const styleSelect = document.getElementById('explanationStyle');
const styleHint = document.getElementById('styleHint');
const hints = {
    beginner: "🌱 Uses simple analogies for absolute beginners",
    technical: "⚙️ Logic analysis with performance insights",
    senior: "🏆 Best practices and refactoring suggestions"
};

if (styleSelect) {
    styleSelect.addEventListener('change', (e) => {
        styleHint.innerText = hints[e.target.value] || "";
    });
}

// 5. Fetch History from MongoDB (FIXED: Complete Logic Re-added)
async function fetchHistory() {
    const list = document.getElementById('historyList');
    if (!list) return;
    
    list.innerHTML = '<div class="loading-pulse"><i class="fas fa-spinner fa-spin"></i> Loading history...</div>';
    
    try {
        const res = await fetch(`/history?email=${userEmail}`);
        const data = await res.json();
        
        if (!data.history || data.history.length === 0) {
            list.innerHTML = '<div class="status-text">No history yet.</div>';
            return;
        }

        list.innerHTML = '';
        data.history.reverse().forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            
            const safeCode = item.code.replace(/`/g, "\\`").replace(/\$/g, "\\$");
            const safeExp = item.explanation.replace(/`/g, "\\`").replace(/\$/g, "\\$");
            
            div.innerHTML = `
                <div class="history-info" onclick="viewHistory(\`${safeCode}\`, \`${safeExp}\`)">
                    <strong>${new Date(item.timestamp).toLocaleDateString()}</strong>
                    <p>${item.code.substring(0, 30)}...</p>
                </div>
                <button class="delete-btn" onclick="deleteHistory(event, '${item._id}')"><i class="fas fa-trash"></i></button>
            `;
            list.appendChild(div);
        });
    } catch (error) {
        console.error('History Error:', error);
        list.innerHTML = '<div class="status-text">Failed to load history.</div>';
    }
}

// 6. View Specific History
function viewHistory(code, explanation) {
    if (editor) editor.setValue(code);
    renderMarkdown(explanation);
    updateStats(explanation);
}

// 7. Explain Button Logic
if (explainBtn) {
    explainBtn.addEventListener('click', async () => {
        const code = editor.getValue();
        const output = document.getElementById("output");
        const style = styleSelect.value;
        
        if (!code.trim() || code.includes("Paste your code here")) {
            showNotification('Please paste some code first!', 'warning');
            return;
        }
        
        explainBtn.disabled = true;
        explainBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        output.innerHTML = `<div class="loading-pulse">Watsonx is analyzing in ${style} mode...</div>`;
        
        try {
            const res = await fetch("/explain", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, email: userEmail, style: style })
            });
            const data = await res.json();

            if (data.explanation) {
                renderMarkdown(data.explanation);
                updateStats(data.explanation);
                output.scrollIntoView({ behavior: 'smooth', block: 'center' });
                showNotification('Analysis Complete!', 'success');
            }
            fetchHistory(); // Refresh history sidebar after new analysis
        } catch (error) {
            showNotification('Server Error', 'error');
        } finally {
            explainBtn.disabled = false;
            explainBtn.innerHTML = '<i class="fas fa-brain"></i> Analyze with IBM Watsonx';
        }
    });
}

// 8. Word & Character Count Utility
function updateStats(text) {
    const wordCount = text.trim().split(/\s+/).length;
    const charCount = text.length;
    const wordEl = document.getElementById('wordCount');
    const charEl = document.getElementById('charCount');
    if (wordEl) wordEl.innerText = `${wordCount} words`;
    if (charEl) charEl.innerText = `${charCount} characters`;
}

// 9. Helper: Render Markdown
function renderMarkdown(content) {
    const output = document.getElementById("output");
    if (typeof marked !== 'undefined') {
        output.innerHTML = marked.parse(content);
    } else {
        output.innerText = content;
    }
}

// 10. Delete and Clear History Logic
async function deleteHistory(event, id) {
    event.stopPropagation();
    if (!confirm("Delete this entry?")) return;
    try {
        const res = await fetch(`/history/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: userEmail })
        });
        if (res.ok) {
            fetchHistory();
            showNotification('Entry deleted', 'success');
        }
    } catch (e) { showNotification('Delete failed', 'error'); }
}

async function clearAllHistory() {
    if (!confirm("Clear all history?")) return;
    try {
        const res = await fetch('/history/all', {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: userEmail })
        });
        if (res.ok) {
            fetchHistory();
            showNotification('History cleared', 'success');
        }
    } catch (e) { showNotification('Clear failed', 'error'); }
}

function logout() {
    if (confirm("Logout?")) {
        localStorage.clear();
        window.location.href = "index.html";
    }
}
// 11. Corrected Copy to Clipboard Logic
const copyBtn = document.getElementById('copyBtn');
if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
        const output = document.getElementById('output');
        // We use innerText to get ONLY the text, ignoring the HTML/Icons
        const textToCopy = output.innerText;

        if (!textToCopy || textToCopy.includes("Your explanation will appear here")) {
            showNotification('Nothing to copy yet!', 'warning');
            return;
        }

        try {
            await navigator.clipboard.writeText(textToCopy);
            
            // Visual feedback on the button itself
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i> <span class="btn-text">Copied!</span>';
            showNotification('Copied to clipboard!', 'success');
            
            setTimeout(() => { copyBtn.innerHTML = originalHTML; }, 2000);
        } catch (err) {
            showNotification('Failed to copy', 'error');
        }
    });
}

// 12. Corrected Download Logic
const downloadBtn = document.getElementById('downloadBtn');
if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
        const outputText = document.getElementById('output').innerText;

        if (!outputText || outputText.includes("Your explanation will appear here")) {
            showNotification('No explanation to download!', 'warning');
            return;
        }

        // Create the file blob
        const blob = new Blob([outputText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        // Filename includes a timestamp for better organization
        a.download = `Code_Explanation_${new Date().getTime()}.txt`;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup to prevent memory leaks
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showNotification('File downloaded!', 'success');
        }, 100);
    });
}
// Share Functionality using Web Share API
const shareBtn = document.getElementById('shareBtn');

if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
        const outputText = document.getElementById('output').innerText;

        // Prevent sharing if there is no content
        if (!outputText || outputText.includes("Your explanation will appear here")) {
            showNotification('Nothing to share yet!', 'warning');
            return;
        }

        // Check if the browser supports the Web Share API
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Code Explanation from AI Code Explainer',
                    text: `Check out this AI-generated code explanation:\n\n${outputText}`,
                    url: window.location.href // Optional: share the link to your app
                });
                showNotification('Shared successfully!', 'success');
            } catch (err) {
                // Handle case where user cancels the share
                console.log('Share cancelled or failed:', err);
            }
        } else {
            // Fallback: Copy to clipboard if Share API is not supported
            navigator.clipboard.writeText(outputText);
            showNotification('Share not supported. Link copied to clipboard!', 'info');
        }
    });
}

// Initialize on page load
fetchHistory();