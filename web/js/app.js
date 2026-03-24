/* ═══════════════════════════════════════════
   NovelForge — Frontend Application
   ═══════════════════════════════════════════ */

const API = '';
let currentNovelId = null;
let currentChapterId = null;
let autoSaveTimer = null;
let lastAIResult = '';

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
    loadNovels();
});

// ─── API Helper ───
async function api(path, options = {}) {
    const url = `${API}${path}`;
    const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    };
    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }
    const res = await fetch(url, config);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Request failed');
    }
    return res.json();
}

// ─── Toast ───
function toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(20px)';
        el.style.transition = '0.3s ease';
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

// ─── Modal ───
function showModal(html) {
    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('modalOverlay').style.display = 'none';
}

// ─── Sidebar ───
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

function toggleWritingSidebar() {
    document.getElementById('writingSidebar').classList.toggle('collapsed');
}

// ─── View Switching ───
function switchView(view) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const viewEl = document.getElementById(`view-${view}`);
    if (viewEl) viewEl.style.display = 'block';
    const navEl = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (navEl) navEl.classList.add('active');

    // Load data for the view
    if (currentNovelId) {
        switch (view) {
            case 'dashboard': loadDashboard(); break;
            case 'outline': loadOutline(); break;
            case 'characters': loadCharacters(); break;
            case 'world': loadWorld(); break;
            case 'plots': loadPlots(); break;
            case 'writing': loadWritingView(); break;
            case 'settings': loadAIConfig(); break;
        }
    }
}

// ═══════════════════════════════════════════
// Novels
// ═══════════════════════════════════════════
async function loadNovels() {
    const novels = await api('/novels');
    const select = document.getElementById('novelSelect');
    select.innerHTML = '<option value="">— 选择或创建小说 —</option>';
    novels.forEach(n => {
        select.innerHTML += `<option value="${n.id}">${n.title}</option>`;
    });
}

async function loadNovel(id) {
    if (!id) {
        currentNovelId = null;
        document.getElementById('sidebarNav').style.display = 'none';
        document.getElementById('totalWordCount').style.display = 'none';
        document.getElementById('welcomeScreen').style.display = 'flex';
        document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
        return;
    }
    currentNovelId = parseInt(id);
    document.getElementById('sidebarNav').style.display = 'block';
    document.getElementById('totalWordCount').style.display = 'block';
    document.getElementById('welcomeScreen').style.display = 'none';
    switchView('dashboard');
}

function showCreateNovel() {
    showModal(`
        <h3>创建新小说</h3>
        <div class="form-group">
            <label>书名</label>
            <input type="text" id="newNovelTitle" class="input" placeholder="输入书名..." autofocus>
        </div>
        <div class="form-group">
            <label>类型</label>
            <input type="text" id="newNovelGenre" class="input" placeholder="如：玄幻、都市、科幻...">
        </div>
        <div class="form-group">
            <label>简介</label>
            <textarea id="newNovelSynopsis" class="input" rows="4" placeholder="简要描述你的故事..."></textarea>
        </div>
        <div class="form-group">
            <label>目标字数</label>
            <input type="number" id="newNovelWordCount" class="input" placeholder="如：300000">
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="closeModal(event)">取消</button>
            <button class="btn btn-primary" onclick="createNovel()">创建</button>
        </div>
    `);
    setTimeout(() => document.getElementById('newNovelTitle')?.focus(), 100);
}

async function createNovel() {
    const title = document.getElementById('newNovelTitle').value.trim();
    if (!title) { toast('请输入书名', 'error'); return; }
    const novel = await api('/novels', {
        method: 'POST',
        body: {
            title,
            genre: document.getElementById('newNovelGenre').value.trim(),
            synopsis: document.getElementById('newNovelSynopsis').value.trim(),
            target_word_count: parseInt(document.getElementById('newNovelWordCount').value) || 0,
        }
    });
    closeModal(event);
    toast('小说创建成功', 'success');
    await loadNovels();
    document.getElementById('novelSelect').value = novel.id;
    loadNovel(novel.id);
}

function editNovel() {
    api(`/novels/${currentNovelId}`).then(novel => {
        showModal(`
            <h3>编辑小说信息</h3>
            <div class="form-group">
                <label>书名</label>
                <input type="text" id="editNovelTitle" class="input" value="${escapeHtml(novel.title)}">
            </div>
            <div class="form-group">
                <label>类型</label>
                <input type="text" id="editNovelGenre" class="input" value="${escapeHtml(novel.genre)}">
            </div>
            <div class="form-group">
                <label>简介</label>
                <textarea id="editNovelSynopsis" class="input" rows="4">${escapeHtml(novel.synopsis)}</textarea>
            </div>
            <div class="form-group">
                <label>状态</label>
                <select id="editNovelStatus" class="input">
                    <option value="planning" ${novel.status === 'planning' ? 'selected' : ''}>策划中</option>
                    <option value="writing" ${novel.status === 'writing' ? 'selected' : ''}>写作中</option>
                    <option value="completed" ${novel.status === 'completed' ? 'selected' : ''}>已完成</option>
                    <option value="paused" ${novel.status === 'paused' ? 'selected' : ''}>暂停</option>
                </select>
            </div>
            <div class="form-group">
                <label>目标字数</label>
                <input type="number" id="editNovelWordCount" class="input" value="${novel.target_word_count}">
            </div>
            <div class="modal-actions">
                <button class="btn btn-danger" onclick="deleteNovel(${novel.id})">删除小说</button>
                <div style="flex:1"></div>
                <button class="btn" onclick="closeModal(event)">取消</button>
                <button class="btn btn-primary" onclick="updateNovel(${novel.id})">保存</button>
            </div>
        `);
    });
}

async function updateNovel(id) {
    await api(`/novels/${id}`, {
        method: 'PUT',
        body: {
            title: document.getElementById('editNovelTitle').value.trim(),
            genre: document.getElementById('editNovelGenre').value.trim(),
            synopsis: document.getElementById('editNovelSynopsis').value.trim(),
            status: document.getElementById('editNovelStatus').value,
            target_word_count: parseInt(document.getElementById('editNovelWordCount').value) || 0,
        }
    });
    closeModal(event);
    toast('已保存', 'success');
    await loadNovels();
    loadDashboard();
}

async function deleteNovel(id) {
    if (!confirm('确定要删除这本小说吗？所有数据将被永久删除。')) return;
    await api(`/novels/${id}`, { method: 'DELETE' });
    closeModal(event);
    toast('已删除', 'success');
    currentNovelId = null;
    await loadNovels();
    document.getElementById('novelSelect').value = '';
    loadNovel('');
}

// ═══════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════
async function loadDashboard() {
    const [novel, chapters, characters, plots] = await Promise.all([
        api(`/novels/${currentNovelId}`),
        api(`/novels/${currentNovelId}/chapters`),
        api(`/novels/${currentNovelId}/characters`),
        api(`/novels/${currentNovelId}/plots`),
    ]);

    document.getElementById('novelTitle').textContent = novel.title;
    document.getElementById('novelSynopsis').textContent = novel.synopsis || '暂无简介';
    document.getElementById('statChapters').textContent = chapters.length;
    document.getElementById('statCharacters').textContent = characters.length;
    document.getElementById('statPlots').textContent = plots.length;

    const totalWords = chapters.reduce((sum, ch) => sum + (ch.word_count || 0), 0);
    document.getElementById('statWords').textContent = formatNumber(totalWords);
    document.getElementById('totalWordCount').innerHTML = `总字数：<strong>${formatNumber(totalWords)}</strong>`;

    // Recent chapters
    const recent = chapters.slice(-5).reverse();
    const container = document.getElementById('recentChapters');
    if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">还没有章节，去写作页面创建吧</div></div>';
    } else {
        container.innerHTML = recent.map(ch => `
            <div class="chapter-item" onclick="switchView('writing'); setTimeout(() => { document.getElementById('chapterSelect').value = ${ch.id}; loadChapter(${ch.id}); }, 100)">
                <span class="chapter-item-title">${escapeHtml(ch.title || `第 ${ch.id} 章`)}</span>
                <div class="chapter-item-meta">
                    <span>${formatNumber(ch.word_count)} 字</span>
                    <span class="status-badge ${ch.status}">${statusLabel(ch.status)}</span>
                </div>
            </div>
        `).join('');
    }
}

// ═══════════════════════════════════════════
// Outline
// ═══════════════════════════════════════════
async function loadOutline() {
    const nodes = await api(`/novels/${currentNovelId}/outline/tree`);
    const container = document.getElementById('outlineTree');

    if (nodes.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📑</div><div class="empty-state-text">还没有大纲节点，点击右上角创建</div></div>';
        return;
    }

    // Build tree
    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.id] = { ...n, children: [] }; });
    const roots = [];
    nodes.forEach(n => {
        if (n.parent_id && nodeMap[n.parent_id]) {
            nodeMap[n.parent_id].children.push(nodeMap[n.id]);
        } else {
            roots.push(nodeMap[n.id]);
        }
    });

    container.innerHTML = roots.map(n => renderOutlineNode(n)).join('');
}

function renderOutlineNode(node) {
    const hasChildren = node.children && node.children.length > 0;
    const typeLabels = { volume: '卷', arc: '篇', chapter: '章', scene: '场' };
    return `
        <div class="outline-node">
            <div class="outline-node-header" onclick="toggleOutlineNode(this)">
                <span class="outline-node-toggle ${hasChildren ? 'expanded' : ''}" style="${hasChildren ? '' : 'visibility:hidden'}">▶</span>
                <span class="outline-node-type">${typeLabels[node.node_type] || node.node_type}</span>
                <span class="outline-node-title">${escapeHtml(node.title)}</span>
                <span class="status-badge ${node.status}">${statusLabel(node.status)}</span>
                <div class="outline-node-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); showEditOutlineNode(${node.id})" title="编辑">✎</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); deleteOutlineNode(${node.id})" title="删除">✕</button>
                </div>
            </div>
            ${node.summary ? `<div class="outline-node-summary">${escapeHtml(node.summary)}</div>` : ''}
            ${hasChildren ? `<div class="outline-node-children">${node.children.map(c => renderOutlineNode(c)).join('')}</div>` : ''}
        </div>
    `;
}

function toggleOutlineNode(header) {
    const toggle = header.querySelector('.outline-node-toggle');
    const children = header.parentElement.querySelector('.outline-node-children');
    if (children) {
        children.style.display = children.style.display === 'none' ? 'block' : 'none';
        toggle.classList.toggle('expanded');
    }
}

function showCreateOutlineNode() {
    const nodes = document.querySelectorAll('.outline-node-title');
    const options = '<option value="">无（顶级节点）</option>' +
        Array.from(nodes).map((n, i) => `<option value="${n.textContent}">${n.textContent}</option>`).join('');

    showModal(`
        <h3>创建大纲节点</h3>
        <div class="form-group">
            <label>类型</label>
            <select id="newOutlineType" class="input">
                <option value="volume">卷</option>
                <option value="arc">篇</option>
                <option value="chapter" selected>章</option>
                <option value="scene">场</option>
            </select>
        </div>
        <div class="form-group">
            <label>标题</label>
            <input type="text" id="newOutlineTitle" class="input" placeholder="章节标题..." autofocus>
        </div>
        <div class="form-group">
            <label>摘要</label>
            <textarea id="newOutlineSummary" class="input" rows="3" placeholder="这一章/节的主要内容..."></textarea>
        </div>
        <div class="form-group">
            <label>备注</label>
            <textarea id="newOutlineNotes" class="input" rows="2" placeholder="写作注意事项..."></textarea>
        </div>
        <div class="form-group">
            <label>预估字数</label>
            <input type="number" id="newOutlineWords" class="input" placeholder="如：3000">
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="closeModal(event)">取消</button>
            <button class="btn btn-primary" onclick="createOutlineNode()">创建</button>
        </div>
    `);
}

async function createOutlineNode() {
    const title = document.getElementById('newOutlineTitle').value.trim();
    if (!title) { toast('请输入标题', 'error'); return; }
    await api(`/novels/${currentNovelId}/outline`, {
        method: 'POST',
        body: {
            node_type: document.getElementById('newOutlineType').value,
            title,
            summary: document.getElementById('newOutlineSummary').value.trim(),
            notes: document.getElementById('newOutlineNotes').value.trim(),
            estimated_words: parseInt(document.getElementById('newOutlineWords').value) || 0,
        }
    });
    closeModal(event);
    toast('节点已创建', 'success');
    loadOutline();
}

function showEditOutlineNode(id) {
    api(`/novels/${currentNovelId}/outline/tree`).then(nodes => {
        const node = nodes.find(n => n.id === id);
        if (!node) return;
        showModal(`
            <h3>编辑大纲节点</h3>
            <div class="form-group">
                <label>类型</label>
                <select id="editOutlineType" class="input">
                    <option value="volume" ${node.node_type === 'volume' ? 'selected' : ''}>卷</option>
                    <option value="arc" ${node.node_type === 'arc' ? 'selected' : ''}>篇</option>
                    <option value="chapter" ${node.node_type === 'chapter' ? 'selected' : ''}>章</option>
                    <option value="scene" ${node.node_type === 'scene' ? 'selected' : ''}>场</option>
                </select>
            </div>
            <div class="form-group">
                <label>标题</label>
                <input type="text" id="editOutlineTitle" class="input" value="${escapeHtml(node.title)}">
            </div>
            <div class="form-group">
                <label>摘要</label>
                <textarea id="editOutlineSummary" class="input" rows="3">${escapeHtml(node.summary)}</textarea>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea id="editOutlineNotes" class="input" rows="2">${escapeHtml(node.notes)}</textarea>
            </div>
            <div class="form-group">
                <label>状态</label>
                <select id="editOutlineStatus" class="input">
                    <option value="planned" ${node.status === 'planned' ? 'selected' : ''}>计划中</option>
                    <option value="writing" ${node.status === 'writing' ? 'selected' : ''}>写作中</option>
                    <option value="done" ${node.status === 'done' ? 'selected' : ''}>已完成</option>
                </select>
            </div>
            <div class="form-group">
                <label>预估字数</label>
                <input type="number" id="editOutlineWords" class="input" value="${node.estimated_words}">
            </div>
            <div class="modal-actions">
                <button class="btn btn-danger" onclick="deleteOutlineNode(${id})">删除</button>
                <div style="flex:1"></div>
                <button class="btn" onclick="closeModal(event)">取消</button>
                <button class="btn btn-primary" onclick="updateOutlineNode(${id})">保存</button>
            </div>
        `);
    });
}

async function updateOutlineNode(id) {
    await api(`/novels/${currentNovelId}/outline/${id}`, {
        method: 'PUT',
        body: {
            node_type: document.getElementById('editOutlineType').value,
            title: document.getElementById('editOutlineTitle').value.trim(),
            summary: document.getElementById('editOutlineSummary').value.trim(),
            notes: document.getElementById('editOutlineNotes').value.trim(),
            status: document.getElementById('editOutlineStatus').value,
            estimated_words: parseInt(document.getElementById('editOutlineWords').value) || 0,
        }
    });
    closeModal(event);
    toast('已保存', 'success');
    loadOutline();
}

async function deleteOutlineNode(id) {
    if (!confirm('确定删除此节点及其子节点？')) return;
    await api(`/novels/${currentNovelId}/outline/${id}`, { method: 'DELETE' });
    closeModal(event);
    toast('已删除', 'success');
    loadOutline();
}

// ═══════════════════════════════════════════
// Characters
// ═══════════════════════════════════════════
async function loadCharacters() {
    const characters = await api(`/novels/${currentNovelId}/characters`);
    const container = document.getElementById('characterList');
    if (characters.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-text">还没有角色，点击右上角创建</div></div>';
        return;
    }
    const roleLabels = { protagonist: '主角', antagonist: '反派', supporting: '配角', minor: '龙套' };
    container.innerHTML = characters.map(c => `
        <div class="card" onclick="showEditCharacter(${c.id})">
            <div class="card-header">
                <span class="card-title">${escapeHtml(c.name)}</span>
                <span class="role-badge ${c.role}">${roleLabels[c.role] || c.role}</span>
            </div>
            <div class="card-body">${escapeHtml(c.description || c.personality || '暂无描述')}</div>
            ${c.tags && c.tags.length ? `<div class="card-footer">${c.tags.map(t => `<span class="category-badge">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        </div>
    `).join('');
}

function showCreateCharacter() {
    showModal(`
        <h3>创建角色</h3>
        <div class="form-group">
            <label>姓名</label>
            <input type="text" id="newCharName" class="input" placeholder="角色姓名..." autofocus>
        </div>
        <div class="form-group">
            <label>角色定位</label>
            <select id="newCharRole" class="input">
                <option value="protagonist">主角</option>
                <option value="antagonist">反派</option>
                <option value="supporting" selected>配角</option>
                <option value="minor">龙套</option>
            </select>
        </div>
        <div class="form-group">
            <label>描述</label>
            <textarea id="newCharDesc" class="input" rows="2" placeholder="角色简介..."></textarea>
        </div>
        <div class="form-group">
            <label>性格</label>
            <textarea id="newCharPersonality" class="input" rows="2" placeholder="性格特征..."></textarea>
        </div>
        <div class="form-group">
            <label>外貌</label>
            <textarea id="newCharAppearance" class="input" rows="2" placeholder="外貌描写..."></textarea>
        </div>
        <div class="form-group">
            <label>背景</label>
            <textarea id="newCharBackground" class="input" rows="2" placeholder="角色背景故事..."></textarea>
        </div>
        <div class="form-group">
            <label>目标</label>
            <textarea id="newCharGoals" class="input" rows="2" placeholder="角色的目标与动机..."></textarea>
        </div>
        <div class="form-group">
            <label>角色弧线</label>
            <textarea id="newCharArc" class="input" rows="2" placeholder="角色的成长/变化轨迹..."></textarea>
        </div>
        <div class="form-group">
            <label>说话风格</label>
            <textarea id="newCharSpeech" class="input" rows="2" placeholder="角色的语言特点..."></textarea>
        </div>
        <div class="form-group">
            <label>标签（逗号分隔）</label>
            <input type="text" id="newCharTags" class="input" placeholder="如：聪明,勇敢,孤僻">
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="closeModal(event)">取消</button>
            <button class="btn btn-primary" onclick="createCharacter()">创建</button>
        </div>
    `);
}

async function createCharacter() {
    const name = document.getElementById('newCharName').value.trim();
    if (!name) { toast('请输入姓名', 'error'); return; }
    const tags = document.getElementById('newCharTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
    await api(`/novels/${currentNovelId}/characters`, {
        method: 'POST',
        body: {
            name,
            role: document.getElementById('newCharRole').value,
            description: document.getElementById('newCharDesc').value.trim(),
            personality: document.getElementById('newCharPersonality').value.trim(),
            appearance: document.getElementById('newCharAppearance').value.trim(),
            background: document.getElementById('newCharBackground').value.trim(),
            goals: document.getElementById('newCharGoals').value.trim(),
            arc_summary: document.getElementById('newCharArc').value.trim(),
            speech_style: document.getElementById('newCharSpeech').value.trim(),
            tags,
        }
    });
    closeModal(event);
    toast('角色已创建', 'success');
    loadCharacters();
}

function showEditCharacter(id) {
    api(`/novels/${currentNovelId}/characters/${id}`).then(c => {
        const roleLabels = { protagonist: '主角', antagonist: '反派', supporting: '配角', minor: '龙套' };
        showModal(`
            <h3>编辑角色 — ${escapeHtml(c.name)}</h3>
            <div class="form-group">
                <label>姓名</label>
                <input type="text" id="editCharName" class="input" value="${escapeHtml(c.name)}">
            </div>
            <div class="form-group">
                <label>角色定位</label>
                <select id="editCharRole" class="input">
                    <option value="protagonist" ${c.role === 'protagonist' ? 'selected' : ''}>主角</option>
                    <option value="antagonist" ${c.role === 'antagonist' ? 'selected' : ''}>反派</option>
                    <option value="supporting" ${c.role === 'supporting' ? 'selected' : ''}>配角</option>
                    <option value="minor" ${c.role === 'minor' ? 'selected' : ''}>龙套</option>
                </select>
            </div>
            <div class="form-group">
                <label>描述</label>
                <textarea id="editCharDesc" class="input" rows="2">${escapeHtml(c.description)}</textarea>
            </div>
            <div class="form-group">
                <label>性格</label>
                <textarea id="editCharPersonality" class="input" rows="2">${escapeHtml(c.personality)}</textarea>
            </div>
            <div class="form-group">
                <label>外貌</label>
                <textarea id="editCharAppearance" class="input" rows="2">${escapeHtml(c.appearance)}</textarea>
            </div>
            <div class="form-group">
                <label>背景</label>
                <textarea id="editCharBackground" class="input" rows="2">${escapeHtml(c.background)}</textarea>
            </div>
            <div class="form-group">
                <label>目标</label>
                <textarea id="editCharGoals" class="input" rows="2">${escapeHtml(c.goals)}</textarea>
            </div>
            <div class="form-group">
                <label>角色弧线</label>
                <textarea id="editCharArc" class="input" rows="2">${escapeHtml(c.arc_summary)}</textarea>
            </div>
            <div class="form-group">
                <label>说话风格</label>
                <textarea id="editCharSpeech" class="input" rows="2">${escapeHtml(c.speech_style)}</textarea>
            </div>
            <div class="form-group">
                <label>标签（逗号分隔）</label>
                <input type="text" id="editCharTags" class="input" value="${(c.tags || []).join(', ')}">
            </div>
            <div class="modal-actions">
                <button class="btn btn-danger" onclick="deleteCharacter(${id})">删除</button>
                <div style="flex:1"></div>
                <button class="btn" onclick="closeModal(event)">取消</button>
                <button class="btn btn-primary" onclick="updateCharacter(${id})">保存</button>
            </div>
        `);
    });
}

async function updateCharacter(id) {
    const tags = document.getElementById('editCharTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
    await api(`/novels/${currentNovelId}/characters/${id}`, {
        method: 'PUT',
        body: {
            name: document.getElementById('editCharName').value.trim(),
            role: document.getElementById('editCharRole').value,
            description: document.getElementById('editCharDesc').value.trim(),
            personality: document.getElementById('editCharPersonality').value.trim(),
            appearance: document.getElementById('editCharAppearance').value.trim(),
            background: document.getElementById('editCharBackground').value.trim(),
            goals: document.getElementById('editCharGoals').value.trim(),
            arc_summary: document.getElementById('editCharArc').value.trim(),
            speech_style: document.getElementById('editCharSpeech').value.trim(),
            tags,
        }
    });
    closeModal(event);
    toast('已保存', 'success');
    loadCharacters();
}

async function deleteCharacter(id) {
    if (!confirm('确定删除此角色？')) return;
    await api(`/novels/${currentNovelId}/characters/${id}`, { method: 'DELETE' });
    closeModal(event);
    toast('已删除', 'success');
    loadCharacters();
}

// ═══════════════════════════════════════════
// World
// ═══════════════════════════════════════════
async function loadWorld() {
    const category = document.getElementById('worldCategoryFilter').value;
    const path = category
        ? `/novels/${currentNovelId}/world?category=${category}`
        : `/novels/${currentNovelId}/world`;
    const elements = await api(path);
    const container = document.getElementById('worldList');
    if (elements.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🌍</div><div class="empty-state-text">还没有世界观设定</div></div>';
        return;
    }
    const catLabels = { location: '地点', organization: '组织', rule: '规则', history: '历史', item: '物品', culture: '文化', magic_system: '魔法体系', technology: '科技' };
    container.innerHTML = elements.map(e => `
        <div class="card" onclick="showEditWorldElement(${e.id})">
            <div class="card-header">
                <span class="card-title">${escapeHtml(e.name)}</span>
                <span class="category-badge">${catLabels[e.category] || e.category}</span>
            </div>
            <div class="card-body">${escapeHtml(e.description || '暂无描述')}</div>
        </div>
    `).join('');
}

function showCreateWorldElement() {
    showModal(`
        <h3>创建世界观设定</h3>
        <div class="form-group">
            <label>分类</label>
            <select id="newWorldCat" class="input">
                <option value="location">地点</option>
                <option value="organization">组织</option>
                <option value="rule">规则</option>
                <option value="history">历史</option>
                <option value="item">物品</option>
                <option value="culture">文化</option>
                <option value="magic_system">魔法体系</option>
                <option value="technology">科技</option>
            </select>
        </div>
        <div class="form-group">
            <label>名称</label>
            <input type="text" id="newWorldName" class="input" placeholder="设定名称..." autofocus>
        </div>
        <div class="form-group">
            <label>描述</label>
            <textarea id="newWorldDesc" class="input" rows="4" placeholder="详细描述..."></textarea>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="closeModal(event)">取消</button>
            <button class="btn btn-primary" onclick="createWorldElement()">创建</button>
        </div>
    `);
}

async function createWorldElement() {
    const name = document.getElementById('newWorldName').value.trim();
    if (!name) { toast('请输入名称', 'error'); return; }
    await api(`/novels/${currentNovelId}/world`, {
        method: 'POST',
        body: {
            category: document.getElementById('newWorldCat').value,
            name,
            description: document.getElementById('newWorldDesc').value.trim(),
        }
    });
    closeModal(event);
    toast('设定已创建', 'success');
    loadWorld();
}

function showEditWorldElement(id) {
    api(`/novels/${currentNovelId}/world`).then(elements => {
        const e = elements.find(el => el.id === id);
        if (!e) return;
        const catLabels = { location: '地点', organization: '组织', rule: '规则', history: '历史', item: '物品', culture: '文化', magic_system: '魔法体系', technology: '科技' };
        showModal(`
            <h3>编辑设定 — ${escapeHtml(e.name)}</h3>
            <div class="form-group">
                <label>分类</label>
                <select id="editWorldCat" class="input">
                    ${Object.entries(catLabels).map(([k, v]) => `<option value="${k}" ${e.category === k ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>名称</label>
                <input type="text" id="editWorldName" class="input" value="${escapeHtml(e.name)}">
            </div>
            <div class="form-group">
                <label>描述</label>
                <textarea id="editWorldDesc" class="input" rows="4">${escapeHtml(e.description)}</textarea>
            </div>
            <div class="modal-actions">
                <button class="btn btn-danger" onclick="deleteWorldElement(${id})">删除</button>
                <div style="flex:1"></div>
                <button class="btn" onclick="closeModal(event)">取消</button>
                <button class="btn btn-primary" onclick="updateWorldElement(${id})">保存</button>
            </div>
        `);
    });
}

async function updateWorldElement(id) {
    await api(`/novels/${currentNovelId}/world/${id}`, {
        method: 'PUT',
        body: {
            category: document.getElementById('editWorldCat').value,
            name: document.getElementById('editWorldName').value.trim(),
            description: document.getElementById('editWorldDesc').value.trim(),
        }
    });
    closeModal(event);
    toast('已保存', 'success');
    loadWorld();
}

async function deleteWorldElement(id) {
    if (!confirm('确定删除此设定？')) return;
    await api(`/novels/${currentNovelId}/world/${id}`, { method: 'DELETE' });
    closeModal(event);
    toast('已删除', 'success');
    loadWorld();
}

// ═══════════════════════════════════════════
// Plot Threads
// ═══════════════════════════════════════════
async function loadPlots() {
    const status = document.getElementById('plotStatusFilter').value;
    const path = status
        ? `/novels/${currentNovelId}/plots?status=${status}`
        : `/novels/${currentNovelId}/plots`;
    const threads = await api(path);
    const container = document.getElementById('plotList');
    if (threads.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🧵</div><div class="empty-state-text">还没有剧情线</div></div>';
        return;
    }
    const typeLabels = { main: '主线', subplot: '支线', mystery: '悬疑', romance: '感情线', conflict: '冲突' };
    container.innerHTML = threads.map(t => `
        <div class="plot-card" onclick="showEditPlotThread(${t.id})">
            <div class="plot-card-header">
                <span class="plot-card-title">${escapeHtml(t.title)}</span>
                <span class="category-badge">${typeLabels[t.thread_type] || t.thread_type}</span>
                <span class="status-badge ${t.status}">${statusLabel(t.status)}</span>
            </div>
            <div class="plot-card-body">${escapeHtml(t.description || '暂无描述')}</div>
        </div>
    `).join('');
}

function showCreatePlotThread() {
    showModal(`
        <h3>创建剧情线</h3>
        <div class="form-group">
            <label>标题</label>
            <input type="text" id="newPlotTitle" class="input" placeholder="剧情线名称..." autofocus>
        </div>
        <div class="form-group">
            <label>类型</label>
            <select id="newPlotType" class="input">
                <option value="main">主线</option>
                <option value="subplot">支线</option>
                <option value="mystery">悬疑</option>
                <option value="romance">感情线</option>
                <option value="conflict">冲突</option>
            </select>
        </div>
        <div class="form-group">
            <label>描述</label>
            <textarea id="newPlotDesc" class="input" rows="3" placeholder="剧情线描述..."></textarea>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="closeModal(event)">取消</button>
            <button class="btn btn-primary" onclick="createPlotThread()">创建</button>
        </div>
    `);
}

async function createPlotThread() {
    const title = document.getElementById('newPlotTitle').value.trim();
    if (!title) { toast('请输入标题', 'error'); return; }
    await api(`/novels/${currentNovelId}/plots`, {
        method: 'POST',
        body: {
            title,
            thread_type: document.getElementById('newPlotType').value,
            description: document.getElementById('newPlotDesc').value.trim(),
        }
    });
    closeModal(event);
    toast('剧情线已创建', 'success');
    loadPlots();
}

function showEditPlotThread(id) {
    api(`/novels/${currentNovelId}/plots`).then(threads => {
        const t = threads.find(th => th.id === id);
        if (!t) return;
        const typeLabels = { main: '主线', subplot: '支线', mystery: '悬疑', romance: '感情线', conflict: '冲突' };
        showModal(`
            <h3>编辑剧情线 — ${escapeHtml(t.title)}</h3>
            <div class="form-group">
                <label>标题</label>
                <input type="text" id="editPlotTitle" class="input" value="${escapeHtml(t.title)}">
            </div>
            <div class="form-group">
                <label>类型</label>
                <select id="editPlotType" class="input">
                    ${Object.entries(typeLabels).map(([k, v]) => `<option value="${k}" ${t.thread_type === k ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>状态</label>
                <select id="editPlotStatus" class="input">
                    <option value="setup" ${t.status === 'setup' ? 'selected' : ''}>铺垫中</option>
                    <option value="developing" ${t.status === 'developing' ? 'selected' : ''}>发展中</option>
                    <option value="climax" ${t.status === 'climax' ? 'selected' : ''}>高潮</option>
                    <option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>已解决</option>
                    <option value="abandoned" ${t.status === 'abandoned' ? 'selected' : ''}>已放弃</option>
                </select>
            </div>
            <div class="form-group">
                <label>描述</label>
                <textarea id="editPlotDesc" class="input" rows="3">${escapeHtml(t.description)}</textarea>
            </div>
            <div class="form-group">
                <label>解决方向</label>
                <textarea id="editPlotResolution" class="input" rows="2">${escapeHtml(t.resolution_notes)}</textarea>
            </div>
            <div class="modal-actions">
                <button class="btn btn-danger" onclick="deletePlotThread(${id})">删除</button>
                <div style="flex:1"></div>
                <button class="btn" onclick="closeModal(event)">取消</button>
                <button class="btn btn-primary" onclick="updatePlotThread(${id})">保存</button>
            </div>
        `);
    });
}

async function updatePlotThread(id) {
    await api(`/novels/${currentNovelId}/plots/${id}`, {
        method: 'PUT',
        body: {
            title: document.getElementById('editPlotTitle').value.trim(),
            thread_type: document.getElementById('editPlotType').value,
            status: document.getElementById('editPlotStatus').value,
            description: document.getElementById('editPlotDesc').value.trim(),
            resolution_notes: document.getElementById('editPlotResolution').value.trim(),
        }
    });
    closeModal(event);
    toast('已保存', 'success');
    loadPlots();
}

async function deletePlotThread(id) {
    if (!confirm('确定删除此剧情线？')) return;
    await api(`/novels/${currentNovelId}/plots/${id}`, { method: 'DELETE' });
    closeModal(event);
    toast('已删除', 'success');
    loadPlots();
}

// ═══════════════════════════════════════════
// Writing & AI
// ═══════════════════════════════════════════
async function loadWritingView() {
    const chapters = await api(`/novels/${currentNovelId}/chapters`);
    const select = document.getElementById('chapterSelect');
    select.innerHTML = '<option value="">— 选择章节 —</option>';
    chapters.forEach(ch => {
        select.innerHTML += `<option value="${ch.id}" ${ch.id === currentChapterId ? 'selected' : ''}>${escapeHtml(ch.title || `第 ${ch.id} 章`)} (${formatNumber(ch.word_count)}字)</option>`;
    });
    if (currentChapterId) {
        loadChapter(currentChapterId);
    }
}

function showCreateChapter() {
    showModal(`
        <h3>创建新章节</h3>
        <div class="form-group">
            <label>章节标题</label>
            <input type="text" id="newChapterTitle" class="input" placeholder="章节标题..." autofocus>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="closeModal(event)">取消</button>
            <button class="btn btn-primary" onclick="createChapter()">创建</button>
        </div>
    `);
}

async function createChapter() {
    const title = document.getElementById('newChapterTitle').value.trim();
    const chapter = await api(`/novels/${currentNovelId}/chapters`, {
        method: 'POST',
        body: { title: title || `第 ${Date.now() % 1000} 章` }
    });
    closeModal(event);
    toast('章节已创建', 'success');
    currentChapterId = chapter.id;
    loadWritingView();
}

async function loadChapter(id) {
    if (!id) {
        document.getElementById('chapterEditor').style.display = 'none';
        currentChapterId = null;
        return;
    }
    currentChapterId = parseInt(id);
    const ch = await api(`/novels/${currentNovelId}/chapters/${id}`);
    document.getElementById('chapterEditor').style.display = 'flex';
    document.getElementById('chapterTitle').value = ch.title || '';
    document.getElementById('chapterContent').value = ch.content || '';
    document.getElementById('chapterWordCount').textContent = `${formatNumber(ch.word_count)} 字`;
    document.getElementById('chapterStatus').textContent = statusLabel(ch.status);
    document.getElementById('chapterStatus').className = `status-badge ${ch.status}`;
    document.getElementById('chapterSelect').value = id;
}

function autoSaveChapter() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
        if (!currentChapterId) return;
        const content = document.getElementById('chapterContent').value;
        const words = countWords(content);
        document.getElementById('chapterWordCount').textContent = `${formatNumber(words)} 字`;
        try {
            await api(`/novels/${currentNovelId}/chapters/${currentChapterId}`, {
                method: 'PUT',
                body: { content }
            });
        } catch (e) { /* silent */ }
    }, 1000);
}

async function saveChapterTitle() {
    if (!currentChapterId) return;
    const title = document.getElementById('chapterTitle').value.trim();
    await api(`/novels/${currentNovelId}/chapters/${currentChapterId}`, {
        method: 'PUT',
        body: { title }
    });
    loadWritingView();
}

async function previewContext() {
    if (!currentNovelId) return;
    const result = await api(`/novels/${currentNovelId}/ai-write/preview-context`, {
        method: 'POST',
        body: {
            chapter_id: currentChapterId || undefined,
            prompt: document.getElementById('aiPrompt').value,
            custom_context: document.getElementById('aiCustomContext').value,
            prev_chapter_count: parseInt(document.getElementById('aiPrevChapters').value) || 0,
        }
    });
    document.getElementById('contextPreview').style.display = 'block';
    document.getElementById('contextPreviewContent').textContent = result.context;
    document.getElementById('contextCharCount').textContent = `共 ${result.char_count} 字符`;
}

async function callAIWrite() {
    if (!currentNovelId) return;
    toast('正在生成...', 'info');
    const result = await api(`/novels/${currentNovelId}/ai-write`, {
        method: 'POST',
        body: {
            chapter_id: currentChapterId || undefined,
            prompt: document.getElementById('aiPrompt').value,
            custom_context: document.getElementById('aiCustomContext').value,
            prev_chapter_count: parseInt(document.getElementById('aiPrevChapters').value) || 0,
        }
    });
    if (result.success) {
        lastAIResult = result.content;
        document.getElementById('aiResult').style.display = 'block';
        document.getElementById('aiResultContent').textContent = result.content;
        toast('生成完成', 'success');
    } else {
        toast(result.error || '生成失败', 'error');
    }
}

function acceptAIResult() {
    if (!lastAIResult || !currentChapterId) return;
    document.getElementById('chapterContent').value = lastAIResult;
    autoSaveChapter();
    document.getElementById('aiResult').style.display = 'none';
    lastAIResult = '';
    toast('已采纳', 'success');
}

function appendAIResult() {
    if (!lastAIResult || !currentChapterId) return;
    const textarea = document.getElementById('chapterContent');
    const existing = textarea.value.trim();
    textarea.value = existing ? existing + '\n\n' + lastAIResult : lastAIResult;
    autoSaveChapter();
    document.getElementById('aiResult').style.display = 'none';
    lastAIResult = '';
    toast('已追加', 'success');
}

function discardAIResult() {
    document.getElementById('aiResult').style.display = 'none';
    lastAIResult = '';
}

// ═══════════════════════════════════════════
// AI Config
// ═══════════════════════════════════════════
async function loadAIConfig() {
    const config = await api(`/novels/${currentNovelId}/ai-config`);
    document.getElementById('aiProvider').value = config.provider;
    document.getElementById('aiApiUrl').value = config.api_url;
    document.getElementById('aiApiKey').value = '';
    document.getElementById('aiModel').value = config.model;
    document.getElementById('aiSystemPrompt').value = config.system_prompt;
    document.getElementById('aiTemperature').value = config.temperature;
    document.getElementById('aiMaxTokens').value = config.max_tokens;
    document.getElementById('aiContextStrategy').value = config.context_strategy;
}

async function saveAIConfig() {
    const body = {
        provider: document.getElementById('aiProvider').value,
        api_url: document.getElementById('aiApiUrl').value,
        model: document.getElementById('aiModel').value,
        system_prompt: document.getElementById('aiSystemPrompt').value,
        temperature: parseFloat(document.getElementById('aiTemperature').value),
        max_tokens: parseInt(document.getElementById('aiMaxTokens').value),
        context_strategy: document.getElementById('aiContextStrategy').value,
    };
    const key = document.getElementById('aiApiKey').value.trim();
    if (key) body.api_key = key;
    await api(`/novels/${currentNovelId}/ai-config`, { method: 'PUT', body });
    toast('设置已保存', 'success');
}

// ═══════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatNumber(n) {
    if (!n) return '0';
    return n.toLocaleString('zh-CN');
}

function statusLabel(status) {
    const map = {
        planned: '计划中', writing: '写作中', done: '已完成',
        draft: '草稿', revised: '修订中', final: '定稿',
        setup: '铺垫中', developing: '发展中', climax: '高潮',
        resolved: '已解决', abandoned: '已放弃',
    };
    return map[status] || status;
}

function countWords(text) {
    if (!text) return 0;
    let count = 0;
    for (const char of text) {
        if ('\u4e00' <= char <= '\u9fff') count++;
    }
    const englishWords = text.match(/[a-zA-Z]+/g);
    count += englishWords ? englishWords.length : 0;
    return count;
}
