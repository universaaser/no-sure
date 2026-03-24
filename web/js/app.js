/* ═══════════════════════════════════════════
   NovelForge v2 — Frontend Application
   ═══════════════════════════════════════════ */

const API = '';
let currentNovelId = null;
let currentChapterId = null;
let autoSaveTimer = null;
let lastAIResult = '';
let isPreviewMode = false;

document.addEventListener('DOMContentLoaded', () => loadNovels());

// ─── API ───
async function api(path, options = {}) {
    const config = { headers: { 'Content-Type': 'application/json' }, ...options };
    if (config.body && typeof config.body === 'object') config.body = JSON.stringify(config.body);
    const res = await fetch(`${API}${path}`, config);
    if (!res.ok) { const err = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(err.detail || 'Request failed'); }
    return res.json();
}

// ─── Toast ───
function toast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; el.style.transition = '0.3s'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ─── Modal ───
function showModal(html) { document.getElementById('modalContent').innerHTML = html; document.getElementById('modalOverlay').style.display = 'flex'; }
function closeModal(e) { if (e && e.target !== e.currentTarget) return; document.getElementById('modalOverlay').style.display = 'none'; }

// ─── Sidebar ───
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); }
function toggleWritingSidebar() { document.getElementById('writingSidebar').classList.toggle('collapsed'); }

// ─── View ───
function switchView(view) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const el = document.getElementById(`view-${view}`);
    if (el) el.style.display = 'block';
    const nav = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (nav) nav.classList.add('active');
    if (currentNovelId) {
        const loaders = { dashboard: loadDashboard, outline: loadOutline, characters: loadCharacters, world: loadWorld, plots: loadPlots, foreshadows: loadForeshadows, writing: loadWritingView, settings: loadAIConfig };
        if (loaders[view]) loaders[view]();
    }
}

// ═══════════════════════════════════════════
// Novels
// ═══════════════════════════════════════════
async function loadNovels() {
    const novels = await api('/novels');
    const s = document.getElementById('novelSelect');
    s.innerHTML = '<option value="">— 选择或创建小说 —</option>';
    novels.forEach(n => s.innerHTML += `<option value="${n.id}">${esc(n.title)}</option>`);
}

async function loadNovel(id) {
    if (!id) { currentNovelId = null; document.getElementById('sidebarNav').style.display = 'none'; document.getElementById('totalWordCount').style.display = 'none'; document.getElementById('welcomeScreen').style.display = 'flex'; document.querySelectorAll('.view').forEach(v => v.style.display = 'none'); return; }
    currentNovelId = parseInt(id);
    document.getElementById('sidebarNav').style.display = 'block';
    document.getElementById('totalWordCount').style.display = 'block';
    document.getElementById('welcomeScreen').style.display = 'none';
    switchView('dashboard');
}

function showCreateNovel() {
    showModal(`<h3>创建新小说</h3>
        <div class="form-group"><label>书名</label><input type="text" id="newNovelTitle" class="input" placeholder="输入书名..." autofocus></div>
        <div class="form-group"><label>类型</label><input type="text" id="newNovelGenre" class="input" placeholder="如：玄幻、都市、科幻..."></div>
        <div class="form-group"><label>简介</label><textarea id="newNovelSynopsis" class="input" rows="4" placeholder="简要描述你的故事..."></textarea></div>
        <div class="form-group"><label>目标字数</label><input type="number" id="newNovelWordCount" class="input" placeholder="如：300000"></div>
        <div class="modal-actions"><button class="btn" onclick="closeModal(event)">取消</button><button class="btn btn-primary" onclick="createNovel()">创建</button></div>`);
    setTimeout(() => document.getElementById('newNovelTitle')?.focus(), 100);
}

async function createNovel() {
    const title = document.getElementById('newNovelTitle').value.trim();
    if (!title) { toast('请输入书名', 'error'); return; }
    const novel = await api('/novels', { method: 'POST', body: { title, genre: document.getElementById('newNovelGenre').value.trim(), synopsis: document.getElementById('newNovelSynopsis').value.trim(), target_word_count: parseInt(document.getElementById('newNovelWordCount').value) || 0 } });
    closeModal(event); toast('小说创建成功', 'success'); await loadNovels();
    document.getElementById('novelSelect').value = novel.id; loadNovel(novel.id);
}

function editNovel() {
    api(`/novels/${currentNovelId}`).then(n => {
        showModal(`<h3>编辑小说信息</h3>
            <div class="form-group"><label>书名</label><input type="text" id="editNovelTitle" class="input" value="${esc(n.title)}"></div>
            <div class="form-group"><label>类型</label><input type="text" id="editNovelGenre" class="input" value="${esc(n.genre)}"></div>
            <div class="form-group"><label>简介</label><textarea id="editNovelSynopsis" class="input" rows="4">${esc(n.synopsis)}</textarea></div>
            <div class="form-group"><label>状态</label><select id="editNovelStatus" class="input"><option value="planning" ${n.status==='planning'?'selected':''}>策划中</option><option value="writing" ${n.status==='writing'?'selected':''}>写作中</option><option value="completed" ${n.status==='completed'?'selected':''}>已完成</option><option value="paused" ${n.status==='paused'?'selected':''}>暂停</option></select></div>
            <div class="form-group"><label>目标字数</label><input type="number" id="editNovelWordCount" class="input" value="${n.target_word_count}"></div>
            <div class="modal-actions"><button class="btn btn-danger" onclick="deleteNovel(${n.id})">删除小说</button><div style="flex:1"></div><button class="btn" onclick="closeModal(event)">取消</button><button class="btn btn-primary" onclick="updateNovel(${n.id})">保存</button></div>`);
    });
}

async function updateNovel(id) {
    await api(`/novels/${id}`, { method: 'PUT', body: { title: document.getElementById('editNovelTitle').value.trim(), genre: document.getElementById('editNovelGenre').value.trim(), synopsis: document.getElementById('editNovelSynopsis').value.trim(), status: document.getElementById('editNovelStatus').value, target_word_count: parseInt(document.getElementById('editNovelWordCount').value) || 0 } });
    closeModal(event); toast('已保存', 'success'); await loadNovels(); loadDashboard();
}

async function deleteNovel(id) {
    if (!confirm('确定删除？所有数据将永久删除。')) return;
    await api(`/novels/${id}`, { method: 'DELETE' });
    closeModal(event); toast('已删除', 'success'); currentNovelId = null; await loadNovels(); document.getElementById('novelSelect').value = ''; loadNovel('');
}

// ═══════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════
async function loadDashboard() {
    const [novel, chapters, characters, plots, foreshadows, world, outline] = await Promise.all([
        api(`/novels/${currentNovelId}`), api(`/novels/${currentNovelId}/chapters`),
        api(`/novels/${currentNovelId}/characters`), api(`/novels/${currentNovelId}/plots`),
        api(`/novels/${currentNovelId}/foreshadows?status=planted`), api(`/novels/${currentNovelId}/world`),
        api(`/novels/${currentNovelId}/outline/tree`),
    ]);
    document.getElementById('novelTitle').textContent = novel.title;
    document.getElementById('novelSynopsis').textContent = novel.synopsis || '暂无简介';
    document.getElementById('statChapters').textContent = chapters.length;
    document.getElementById('statCharacters').textContent = characters.length;
    document.getElementById('statPlots').textContent = plots.length;
    document.getElementById('statForeshadows').textContent = foreshadows.length;
    document.getElementById('statWorld').textContent = world.length;
    document.getElementById('statOutline').textContent = outline.length;
    const tw = chapters.reduce((s, c) => s + (c.word_count || 0), 0);
    document.getElementById('statWords').textContent = fmt(tw);
    document.getElementById('totalWordCount').innerHTML = `总字数：<strong>${fmt(tw)}</strong>`;
    const recent = chapters.slice(-5).reverse();
    const rc = document.getElementById('recentChapters');
    rc.innerHTML = recent.length ? recent.map(ch => `<div class="chapter-item" onclick="switchView('writing');setTimeout(()=>{document.getElementById('chapterSelect').value=${ch.id};loadChapter(${ch.id})},100)"><span class="chapter-item-title">${esc(ch.title||`第 ${ch.id} 章`)}</span><div class="chapter-item-meta"><span>${fmt(ch.word_count)} 字</span><span class="status-badge ${ch.status}">${statusLabel(ch.status)}</span></div></div>`).join('') : '<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">还没有章节</div></div>';
}

// ═══════════════════════════════════════════
// Export
// ═══════════════════════════════════════════
function showExportMenu() {
    showModal(`<h3>导出小说</h3>
        <div class="form-group"><label>选择格式</label></div>
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px">
            <button class="btn" onclick="exportFile('txt')" style="justify-content:flex-start;gap:12px;padding:16px"><span style="font-size:1.2rem">📄</span><div><div style="font-weight:600">纯文本 (TXT)</div><div style="font-size:0.8rem;color:var(--text-muted)">最通用的格式，任何设备都能打开</div></div></button>
            <button class="btn" onclick="exportFile('epub')" style="justify-content:flex-start;gap:12px;padding:16px"><span style="font-size:1.2rem">📚</span><div><div style="font-weight:600">电子书 (EPUB)</div><div style="font-size:0.8rem;color:var(--text-muted)">可在 Kindle、微信读书等阅读器打开</div></div></button>
            <button class="btn" onclick="exportFile('json')" style="justify-content:flex-start;gap:12px;padding:16px"><span style="font-size:1.2rem">💾</span><div><div style="font-weight:600">数据备份 (JSON)</div><div style="font-size:0.8rem;color:var(--text-muted)">完整数据备份，可用于迁移和恢复</div></div></button>
        </div>
        <div class="modal-actions"><button class="btn" onclick="closeModal(event)">关闭</button></div>`);
}

function exportFile(format) {
    window.open(`/novels/${currentNovelId}/export/${format}`, '_blank');
    closeModal(event);
    toast(`正在导出 ${format.toUpperCase()}...`, 'info');
}

// ═══════════════════════════════════════════
// Consistency Check
// ═══════════════════════════════════════════
async function runConsistencyCheck() {
    toast('正在检查一致性...', 'info');
    const result = await api(`/novels/${currentNovelId}/consistency-check`, { method: 'POST' });
    if (!result.success) { toast(result.error || '检查失败', 'error'); return; }
    const severityLabel = { error: '错误', warning: '警告', info: '提示' };
    showModal(`<h3>一致性检查报告</h3>
        <div class="consistency-summary">${esc(result.summary)}</div>
        <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">发现 ${result.issues.length} 个问题</div>
        <div class="issue-list">${result.issues.length ? result.issues.map(i => `<div class="issue-card severity-${i.severity}"><div class="issue-header"><span class="issue-category">${esc(i.category)}</span><span class="issue-severity severity-${i.severity}">${severityLabel[i.severity]||i.severity}</span></div><div class="issue-description">${esc(i.description)}</div>${i.chapter_refs.length?`<div class="issue-refs">涉及：${i.chapter_refs.map(r=>esc(r)).join('、')}</div>`:''}</div>`).join('') : '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">没有发现问题，太棒了！</div></div>'}</div>
        <div class="modal-actions"><button class="btn" onclick="closeModal(event)">关闭</button></div>`);
}

// ═══════════════════════════════════════════
// Outline
// ═══════════════════════════════════════════
async function loadOutline() {
    const nodes = await api(`/novels/${currentNovelId}/outline/tree`);
    const c = document.getElementById('outlineTree');
    if (!nodes.length) { c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📑</div><div class="empty-state-text">还没有大纲节点</div></div>'; return; }
    const map = {}; nodes.forEach(n => map[n.id] = { ...n, children: [] });
    const roots = []; nodes.forEach(n => { if (n.parent_id && map[n.parent_id]) map[n.parent_id].children.push(map[n.id]); else roots.push(map[n.id]); });
    c.innerHTML = roots.map(n => renderOutlineNode(n)).join('');
}

function renderOutlineNode(n) {
    const has = n.children && n.children.length > 0;
    const tl = { volume: '卷', arc: '篇', chapter: '章', scene: '场' };
    return `<div class="outline-node"><div class="outline-node-header" onclick="toggleOutlineNode(this)"><span class="outline-node-toggle ${has?'expanded':''}" style="${has?'':'visibility:hidden'}">▶</span><span class="outline-node-type">${tl[n.node_type]||n.node_type}</span><span class="outline-node-title">${esc(n.title)}</span><span class="status-badge ${n.status}">${statusLabel(n.status)}</span><div class="outline-node-actions"><button class="btn-icon" onclick="event.stopPropagation();showEditOutlineNode(${n.id})">✎</button><button class="btn-icon" onclick="event.stopPropagation();deleteOutlineNode(${n.id})">✕</button></div></div>${n.summary?`<div class="outline-node-summary">${esc(n.summary)}</div>`:''}${has?`<div class="outline-node-children">${n.children.map(c=>renderOutlineNode(c)).join('')}</div>`:''}</div>`;
}

function toggleOutlineNode(h) { const t = h.querySelector('.outline-node-toggle'); const ch = h.parentElement.querySelector('.outline-node-children'); if (ch) { ch.style.display = ch.style.display === 'none' ? 'block' : 'none'; t.classList.toggle('expanded'); } }

function showCreateOutlineNode() {
    showModal(`<h3>创建大纲节点</h3>
        <div class="form-group"><label>类型</label><select id="newOutlineType" class="input"><option value="volume">卷</option><option value="arc">篇</option><option value="chapter" selected>章</option><option value="scene">场</option></select></div>
        <div class="form-group"><label>标题</label><input type="text" id="newOutlineTitle" class="input" placeholder="标题..." autofocus></div>
        <div class="form-group"><label>摘要</label><textarea id="newOutlineSummary" class="input" rows="3"></textarea></div>
        <div class="form-group"><label>备注</label><textarea id="newOutlineNotes" class="input" rows="2"></textarea></div>
        <div class="form-group"><label>预估字数</label><input type="number" id="newOutlineWords" class="input"></div>
        <div class="modal-actions"><button class="btn" onclick="closeModal(event)">取消</button><button class="btn btn-primary" onclick="createOutlineNode()">创建</button></div>`);
}

async function createOutlineNode() {
    const title = document.getElementById('newOutlineTitle').value.trim();
    if (!title) { toast('请输入标题', 'error'); return; }
    await api(`/novels/${currentNovelId}/outline`, { method: 'POST', body: { node_type: document.getElementById('newOutlineType').value, title, summary: document.getElementById('newOutlineSummary').value.trim(), notes: document.getElementById('newOutlineNotes').value.trim(), estimated_words: parseInt(document.getElementById('newOutlineWords').value) || 0 } });
    closeModal(event); toast('已创建', 'success'); loadOutline();
}

function showEditOutlineNode(id) {
    api(`/novels/${currentNovelId}/outline/tree`).then(nodes => { const n = nodes.find(x => x.id === id); if (!n) return;
        showModal(`<h3>编辑大纲节点</h3>
            <div class="form-group"><label>类型</label><select id="editOutlineType" class="input"><option value="volume" ${n.node_type==='volume'?'selected':''}>卷</option><option value="arc" ${n.node_type==='arc'?'selected':''}>篇</option><option value="chapter" ${n.node_type==='chapter'?'selected':''}>章</option><option value="scene" ${n.node_type==='scene'?'selected':''}>场</option></select></div>
            <div class="form-group"><label>标题</label><input type="text" id="editOutlineTitle" class="input" value="${esc(n.title)}"></div>
            <div class="form-group"><label>摘要</label><textarea id="editOutlineSummary" class="input" rows="3">${esc(n.summary)}</textarea></div>
            <div class="form-group"><label>备注</label><textarea id="editOutlineNotes" class="input" rows="2">${esc(n.notes)}</textarea></div>
            <div class="form-group"><label>状态</label><select id="editOutlineStatus" class="input"><option value="planned" ${n.status==='planned'?'selected':''}>计划中</option><option value="writing" ${n.status==='writing'?'selected':''}>写作中</option><option value="done" ${n.status==='done'?'selected':''}>已完成</option></select></div>
            <div class="form-group"><label>预估字数</label><input type="number" id="editOutlineWords" class="input" value="${n.estimated_words}"></div>
            <div class="modal-actions"><button class="btn btn-danger" onclick="deleteOutlineNode(${id})">删除</button><div style="flex:1"></div><button class="btn" onclick="closeModal(event)">取消</button><button class="btn btn-primary" onclick="updateOutlineNode(${id})">保存</button></div>`);
    });
}

async function updateOutlineNode(id) {
    await api(`/novels/${currentNovelId}/outline/${id}`, { method: 'PUT', body: { node_type: document.getElementById('editOutlineType').value, title: document.getElementById('editOutlineTitle').value.trim(), summary: document.getElementById('editOutlineSummary').value.trim(), notes: document.getElementById('editOutlineNotes').value.trim(), status: document.getElementById('editOutlineStatus').value, estimated_words: parseInt(document.getElementById('editOutlineWords').value) || 0 } });
    closeModal(event); toast('已保存', 'success'); loadOutline();
}

async function deleteOutlineNode(id) { if (!confirm('确定删除？')) return; await api(`/novels/${currentNovelId}/outline/${id}`, { method: 'DELETE' }); closeModal(event); toast('已删除', 'success'); loadOutline(); }

// ═══════════════════════════════════════════
// Characters
// ═══════════════════════════════════════════
async function loadCharacters() {
    const chars = await api(`/novels/${currentNovelId}/characters`);
    const c = document.getElementById('characterList');
    if (!chars.length) { c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-text">还没有角色</div></div>'; return; }
    const rl = { protagonist: '主角', antagonist: '反派', supporting: '配角', minor: '龙套' };
    c.innerHTML = chars.map(ch => `<div class="card" onclick="showEditCharacter(${ch.id})"><div class="card-header"><span class="card-title">${esc(ch.name)}</span><span class="role-badge ${ch.role}">${rl[ch.role]||ch.role}</span></div><div class="card-body">${esc(ch.description||ch.personality||'暂无描述')}</div>${ch.tags&&ch.tags.length?`<div class="card-footer">${ch.tags.map(t=>`<span class="category-badge">${esc(t)}</span>`).join('')}</div>`:''}</div>`).join('');
}

function showCreateCharacter() {
    showModal(`<h3>创建角色</h3>
        <div class="form-group"><label>姓名</label><input type="text" id="newCharName" class="input" autofocus></div>
        <div class="form-group"><label>角色定位</label><select id="newCharRole" class="input"><option value="protagonist">主角</option><option value="antagonist">反派</option><option value="supporting" selected>配角</option><option value="minor">龙套</option></select></div>
        <div class="form-group"><label>描述</label><textarea id="newCharDesc" class="input" rows="2"></textarea></div>
        <div class="form-group"><label>性格</label><textarea id="newCharPersonality" class="input" rows="2"></textarea></div>
        <div class="form-group"><label>外貌</label><textarea id="newCharAppearance" class="input" rows="2"></textarea></div>
        <div class="form-group"><label>背景</label><textarea id="newCharBackground" class="input" rows="2"></textarea></div>
        <div class="form-group"><label>目标</label><textarea id="newCharGoals" class="input" rows="2"></textarea></div>
        <div class="form-group"><label>角色弧线</label><textarea id="newCharArc" class="input" rows="2"></textarea></div>
        <div class="form-group"><label>说话风格</label><textarea id="newCharSpeech" class="input" rows="2"></textarea></div>
        <div class="form-group"><label>一句话简介（上下文裁剪时使用）</label><input type="text" id="newCharBrief" class="input" placeholder="如：天才少年，性格坚韧，剑术出众"></div>
        <div class="form-group"><label>标签（逗号分隔）</label><input type="text" id="newCharTags" class="input" placeholder="聪明,勇敢"></div>
        <div class="modal-actions"><button class="btn" onclick="closeModal(event)">取消</button><button class="btn btn-primary" onclick="createCharacter()">创建</button></div>`);
}

async function createCharacter() {
    const name = document.getElementById('newCharName').value.trim();
    if (!name) { toast('请输入姓名', 'error'); return; }
    const tags = document.getElementById('newCharTags').value.split(/[,，]/).map(t=>t.trim()).filter(Boolean);
    await api(`/novels/${currentNovelId}/characters`, { method: 'POST', body: { name, role: document.getElementById('newCharRole').value, description: document.getElementById('newCharDesc').value.trim(), personality: document.getElementById('newCharPersonality').value.trim(), appearance: document.getElementById('newCharAppearance').value.trim(), background: document.getElementById('newCharBackground').value.trim(), goals: document.getElementById('newCharGoals').value.trim(), arc_summary: document.getElementById('newCharArc').value.trim(), speech_style: document.getElementById('newCharSpeech').value.trim(), summary_brief: document.getElementById('newCharBrief').value.trim(), tags } });
    closeModal(event); toast('已创建', 'success'); loadCharacters();
}

function showEditCharacter(id) {
    api(`/novels/${currentNovelId}/characters/${id}`).then(c => {
        showModal(`<h3>编辑角色 — ${esc(c.name)}</h3>
            <div class="form-group"><label>姓名</label><input type="text" id="editCharName" class="input" value="${esc(c.name)}"></div>
            <div class="form-group"><label>角色定位</label><select id="editCharRole" class="input"><option value="protagonist" ${c.role==='protagonist'?'selected':''}>主角</option><option value="antagonist" ${c.role==='antagonist'?'selected':''}>反派</option><option value="supporting" ${c.role==='supporting'?'selected':''}>配角</option><option value="minor" ${c.role==='minor'?'selected':''}>龙套</option></select></div>
            <div class="form-group"><label>描述</label><textarea id="editCharDesc" class="input" rows="2">${esc(c.description)}</textarea></div>
            <div class="form-group"><label>性格</label><textarea id="editCharPersonality" class="input" rows="2">${esc(c.personality)}</textarea></div>
            <div class="form-group"><label>外貌</label><textarea id="editCharAppearance" class="input" rows="2">${esc(c.appearance)}</textarea></div>
            <div class="form-group"><label>背景</label><textarea id="editCharBackground" class="input" rows="2">${esc(c.background)}</textarea></div>
            <div class="form-group"><label>目标</label><textarea id="editCharGoals" class="input" rows="2">${esc(c.goals)}</textarea></div>
            <div class="form-group"><label>角色弧线</label><textarea id="editCharArc" class="input" rows="2">${esc(c.arc_summary)}</textarea></div>
            <div class="form-group"><label>说话风格</label><textarea id="editCharSpeech" class="input" rows="2">${esc(c.speech_style)}</textarea></div>
            <div class="form-group"><label>一句话简介</label><input type="text" id="editCharBrief" class="input" value="${esc(c.summary_brief)}"></div>
            <div class="form-group"><label>标签（逗号分隔）</label><input type="text" id="editCharTags" class="input" value="${(c.tags||[]).join(', ')}"></div>
            <div class="modal-actions"><button class="btn btn-danger" onclick="deleteCharacter(${id})">删除</button><div style="flex:1"></div><button class="btn" onclick="closeModal(event)">取消</button><button class="btn btn-primary" onclick="updateCharacter(${id})">保存</button></div>`);
    });
}

async function updateCharacter(id) {
    const tags = document.getElementById('editCharTags').value.split(/[,，]/).map(t=>t.trim()).filter(Boolean);
    await api(`/novels/${currentNovelId}/characters/${id}`, { method: 'PUT', body: { name: document.getElementById('editCharName').value.trim(), role: document.getElementById('editCharRole').value, description: document.getElementById('editCharDesc').value.trim(), personality: document.getElementById('editCharPersonality').value.trim(), appearance: document.getElementById('editCharAppearance').value.trim(), background: document.getElementById('editCharBackground').value.trim(), goals: document.getElementById('editCharGoals').value.trim(), arc_summary: document.getElementById('editCharArc').value.trim(), speech_style: document.getElementById('editCharSpeech').value.trim(), summary_brief: document.getElementById('editCharBrief').value.trim(), tags } });
    closeModal(event); toast('已保存', 'success'); loadCharacters();
}

async function deleteCharacter(id) { if (!confirm('确定删除？')) return; await api(`/novels/${currentNovelId}/characters/${id}`, { method: 'DELETE' }); closeModal(event); toast('已删除', 'success'); loadCharacters(); }

// ═══════════════════════════════════════════
// World
// ═══════════════════════════════════════════
async function loadWorld() {
    const cat = document.getElementById('worldCategoryFilter').value;
    const els = await api(`/novels/${currentNovelId}/world${cat?`?category=${cat}`:''}`);
    const c = document.getElementById('worldList');
    if (!els.length) { c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🌍</div><div class="empty-state-text">还没有世界观设定</div></div>'; return; }
    const cl = { location:'地点', organization:'组织', rule:'规则', history:'历史', item:'物品', culture:'文化', magic_system:'魔法体系', technology:'科技' };
    c.innerHTML = els.map(e => `<div class="card" onclick="showEditWorldElement(${e.id})"><div class="card-header"><span class="card-title">${esc(e.name)}</span><span class="category-badge">${cl[e.category]||e.category}</span></div><div class="card-body">${esc(e.description||'暂无描述')}</div></div>`).join('');
}

function showCreateWorldElement() {
    showModal(`<h3>创建世界观设定</h3>
        <div class="form-group"><label>分类</label><select id="newWorldCat" class="input"><option value="location">地点</option><option value="organization">组织</option><option value="rule">规则</option><option value="history">历史</option><option value="item">物品</option><option value="culture">文化</option><option value="magic_system">魔法体系</option><option value="technology">科技</option></select></div>
        <div class="form-group"><label>名称</label><input type="text" id="newWorldName" class="input" autofocus></div>
        <div class="form-group"><label>描述</label><textarea id="newWorldDesc" class="input" rows="4"></textarea></div>
        <div class="form-group"><label>一句话简介（上下文裁剪时使用）</label><input type="text" id="newWorldBrief" class="input" placeholder="简短描述"></div>
        <div class="modal-actions"><button class="btn" onclick="closeModal(event)">取消</button><button class="btn btn-primary" onclick="createWorldElement()">创建</button></div>`);
}

async function createWorldElement() {
    const name = document.getElementById('newWorldName').value.trim();
    if (!name) { toast('请输入名称', 'error'); return; }
    await api(`/novels/${currentNovelId}/world`, { method: 'POST', body: { category: document.getElementById('newWorldCat').value, name, description: document.getElementById('newWorldDesc').value.trim(), summary_brief: document.getElementById('newWorldBrief').value.trim() } });
    closeModal(event); toast('已创建', 'success'); loadWorld();
}

function showEditWorldElement(id) {
    api(`/novels/${currentNovelId}/world`).then(els => { const e = els.find(x=>x.id===id); if(!e) return;
        const cl = { location:'地点', organization:'组织', rule:'规则', history:'历史', item:'物品', culture:'文化', magic_system:'魔法体系', technology:'科技' };
        showModal(`<h3>编辑设定 — ${esc(e.name)}</h3>
            <div class="form-group"><label>分类</label><select id="editWorldCat" class="input">${Object.entries(cl).map(([k,v])=>`<option value="${k}" ${e.category===k?'selected':''}>${v}</option>`).join('')}</select></div>
            <div class="form-group"><label>名称</label><input type="text" id="editWorldName" class="input" value="${esc(e.name)}"></div>
            <div class="form-group"><label>描述</label><textarea id="editWorldDesc" class="input" rows="4">${esc(e.description)}</textarea></div>
            <div class="form-group"><label>一句话简介</label><input type="text" id="editWorldBrief" class="input" value="${esc(e.summary_brief)}"></div>
            <div class="modal-actions"><button class="btn btn-danger" onclick="deleteWorldElement(${id})">删除</button><div style="flex:1"></div><button class="btn" onclick="closeModal(event)">取消</button><button class="btn btn-primary" onclick="updateWorldElement(${id})">保存</button></div>`);
    });
}

async function updateWorldElement(id) {
    await api(`/novels/${currentNovelId}/world/${id}`, { method: 'PUT', body: { category: document.getElementById('editWorldCat').value, name: document.getElementById('editWorldName').value.trim(), description: document.getElementById('editWorldDesc').value.trim(), summary_brief: document.getElementById('editWorldBrief').value.trim() } });
    closeModal(event); toast('已保存', 'success'); loadWorld();
}

async function deleteWorldElement(id) { if (!confirm('确定删除？')) return; await api(`/novels/${currentNovelId}/world/${id}`, { method: 'DELETE' }); closeModal(event); toast('已删除', 'success'); loadWorld(); }

// ═══════════════════════════════════════════
// Plot Threads
// ═══════════════════════════════════════════
async function loadPlots() {
    const status = document.getElementById('plotStatusFilter').value;
    const threads = await api(`/novels/${currentNovelId}/plots${status?`?status=${status}`:''}`);
    const c = document.getElementById('plotList');
    if (!threads.length) { c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🧵</div><div class="empty-state-text">还没有剧情线</div></div>'; return; }
    const tl = { main:'主线', subplot:'支线', mystery:'悬疑', romance:'感情线', conflict:'冲突' };
    c.innerHTML = threads.map(t => `<div class="plot-card" onclick="showEditPlotThread(${t.id})"><div class="plot-card-header"><span class="plot-card-title">${esc(t.title)}</span><span class="category-badge">${tl[t.thread_type]||t.thread_type}</span><span class="status-badge ${t.status}">${statusLabel(t.status)}</span></div><div class="plot-card-body">${esc(t.description||'暂无描述')}</div></div>`).join('');
}

function showCreatePlotThread() {
    showModal(`<h3>创建剧情线</h3>
        <div class="form-group"><label>标题</label><input type="text" id="newPlotTitle" class="input" autofocus></div>
        <div class="form-group"><label>类型</label><select id="newPlotType" class="input"><option value="main">主线</option><option value="subplot">支线</option><option value="mystery">悬疑</option><option value="romance">感情线</option><option value="conflict">冲突</option></select></div>
        <div class="form-group"><label>描述</label><textarea id="newPlotDesc" class="input" rows="3"></textarea></div>
        <div class="modal-actions"><button class="btn" onclick="closeModal(event)">取消</button><button class="btn btn-primary" onclick="createPlotThread()">创建</button></div>`);
}

async function createPlotThread() {
    const title = document.getElementById('newPlotTitle').value.trim();
    if (!title) { toast('请输入标题', 'error'); return; }
    await api(`/novels/${currentNovelId}/plots`, { method: 'POST', body: { title, thread_type: document.getElementById('newPlotType').value, description: document.getElementById('newPlotDesc').value.trim() } });
    closeModal(event); toast('已创建', 'success'); loadPlots();
}

function showEditPlotThread(id) {
    api(`/novels/${currentNovelId}/plots`).then(threads => { const t = threads.find(x=>x.id===id); if(!t) return;
        const tl = { main:'主线', subplot:'支线', mystery:'悬疑', romance:'感情线', conflict:'冲突' };
        showModal(`<h3>编辑剧情线 — ${esc(t.title)}</h3>
            <div class="form-group"><label>标题</label><input type="text" id="editPlotTitle" class="input" value="${esc(t.title)}"></div>
            <div class="form-group"><label>类型</label><select id="editPlotType" class="input">${Object.entries(tl).map(([k,v])=>`<option value="${k}" ${t.thread_type===k?'selected':''}>${v}</option>`).join('')}</select></div>
            <div class="form-group"><label>状态</label><select id="editPlotStatus" class="input"><option value="setup" ${t.status==='setup'?'selected':''}>铺垫中</option><option value="developing" ${t.status==='developing'?'selected':''}>发展中</option><option value="climax" ${t.status==='climax'?'selected':''}>高潮</option><option value="resolved" ${t.status==='resolved'?'selected':''}>已解决</option><option value="abandoned" ${t.status==='abandoned'?'selected':''}>已放弃</option></select></div>
            <div class="form-group"><label>描述</label><textarea id="editPlotDesc" class="input" rows="3">${esc(t.description)}</textarea></div>
            <div class="form-group"><label>解决方向</label><textarea id="editPlotResolution" class="input" rows="2">${esc(t.resolution_notes)}</textarea></div>
            <div class="modal-actions"><button class="btn btn-danger" onclick="deletePlotThread(${id})">删除</button><div style="flex:1"></div><button class="btn" onclick="closeModal(event)">取消</button><button class="btn btn-primary" onclick="updatePlotThread(${id})">保存</button></div>`);
    });
}

async function updatePlotThread(id) {
    await api(`/novels/${currentNovelId}/plots/${id}`, { method: 'PUT', body: { title: document.getElementById('editPlotTitle').value.trim(), thread_type: document.getElementById('editPlotType').value, status: document.getElementById('editPlotStatus').value, description: document.getElementById('editPlotDesc').value.trim(), resolution_notes: document.getElementById('editPlotResolution').value.trim() } });
    closeModal(event); toast('已保存', 'success'); loadPlots();
}

async function deletePlotThread(id) { if (!confirm('确定删除？')) return; await api(`/novels/${currentNovelId}/plots/${id}`, { method: 'DELETE' }); closeModal(event); toast('已删除', 'success'); loadPlots(); }

// ═══════════════════════════════════════════
// Foreshadows
// ═══════════════════════════════════════════
async function loadForeshadows() {
    const status = document.getElementById('foreshadowStatusFilter').value;
    const items = await api(`/novels/${currentNovelId}/foreshadows${status?`?status=${status}`:''}`);
    const c = document.getElementById('foreshadowList');
    if (!items.length) { c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔮</div><div class="empty-state-text">还没有伏笔</div></div>'; return; }
    const sl = { planted:'已埋设', partially_revealed:'部分揭示', resolved:'已揭示', abandoned:'已放弃' };
    c.innerHTML = items.map(f => `<div class="foreshadow-card status-${f.status}" onclick="showEditForeshadow(${f.id})"><div class="foreshadow-header"><span class="foreshadow-title">${esc(f.title)}</span><span class="foreshadow-priority">P${f.priority}</span><span class="status-badge ${f.status}">${sl[f.status]||f.status}</span></div><div class="foreshadow-body">${esc(f.description||'暂无描述')}</div>${f.planted_detail?`<div class="foreshadow-detail"><div class="foreshadow-detail-label">埋设内容</div>${esc(f.planted_detail)}</div>`:''}${f.expected_resolution?`<div class="foreshadow-detail"><div class="foreshadow-detail-label">预期揭示</div>${esc(f.expected_resolution)}</div>`:''}</div>`).join('');
}

function showCreateForeshadow() {
    showModal(`<h3>创建伏笔</h3>
        <div class="form-group"><label>标题</label><input type="text" id="newFsTitle" class="input" placeholder="如：林凡的胎记" autofocus></div>
        <div class="form-group"><label>描述</label><textarea id="newFsDesc" class="input" rows="2"></textarea></div>
        <div class="form-group"><label>埋设内容</label><textarea id="newFsPlanted" class="input" rows="2" placeholder="具体埋了什么伏笔..."></textarea></div>
        <div class="form-group"><label>预期揭示方式</label><textarea id="newFsResolution" class="input" rows="2" placeholder="计划如何揭示..."></textarea></div>
        <div class="form-group"><label>优先级 (1-10)</label><input type="number" id="newFsPriority" class="input" value="5" min="1" max="10"></div>
        <div class="form-group"><label>备注</label><textarea id="newFsNotes" class="input" rows="2"></textarea></div>
        <div class="modal-actions"><button class="btn" onclick="closeModal(event)">取消</button><button class="btn btn-primary" onclick="createForeshadow()">创建</button></div>`);
}

async function createForeshadow() {
    const title = document.getElementById('newFsTitle').value.trim();
    if (!title) { toast('请输入标题', 'error'); return; }
    await api(`/novels/${currentNovelId}/foreshadows`, { method: 'POST', body: { title, description: document.getElementById('newFsDesc').value.trim(), planted_detail: document.getElementById('newFsPlanted').value.trim(), expected_resolution: document.getElementById('newFsResolution').value.trim(), priority: parseInt(document.getElementById('newFsPriority').value) || 5, notes: document.getElementById('newFsNotes').value.trim() } });
    closeModal(event); toast('已创建', 'success'); loadForeshadows();
}

function showEditForeshadow(id) {
    api(`/novels/${currentNovelId}/foreshadows`).then(items => { const f = items.find(x=>x.id===id); if(!f) return;
        showModal(`<h3>编辑伏笔 — ${esc(f.title)}</h3>
            <div class="form-group"><label>标题</label><input type="text" id="editFsTitle" class="input" value="${esc(f.title)}"></div>
            <div class="form-group"><label>描述</label><textarea id="editFsDesc" class="input" rows="2">${esc(f.description)}</textarea></div>
            <div class="form-group"><label>埋设内容</label><textarea id="editFsPlanted" class="input" rows="2">${esc(f.planted_detail)}</textarea></div>
            <div class="form-group"><label>预期揭示方式</label><textarea id="editFsResolution" class="input" rows="2">${esc(f.expected_resolution)}</textarea></div>
            <div class="form-group"><label>状态</label><select id="editFsStatus" class="input"><option value="planted" ${f.status==='planted'?'selected':''}>已埋设</option><option value="partially_revealed" ${f.status==='partially_revealed'?'selected':''}>部分揭示</option><option value="resolved" ${f.status==='resolved'?'selected':''}>已揭示</option><option value="abandoned" ${f.status==='abandoned'?'selected':''}>已放弃</option></select></div>
            <div class="form-group"><label>优先级 (1-10)</label><input type="number" id="editFsPriority" class="input" value="${f.priority}" min="1" max="10"></div>
            <div class="form-group"><label>备注</label><textarea id="editFsNotes" class="input" rows="2">${esc(f.notes)}</textarea></div>
            <div class="modal-actions"><button class="btn btn-danger" onclick="deleteForeshadow(${id})">删除</button><div style="flex:1"></div><button class="btn" onclick="closeModal(event)">取消</button><button class="btn btn-primary" onclick="updateForeshadow(${id})">保存</button></div>`);
    });
}

async function updateForeshadow(id) {
    await api(`/novels/${currentNovelId}/foreshadows/${id}`, { method: 'PUT', body: { title: document.getElementById('editFsTitle').value.trim(), description: document.getElementById('editFsDesc').value.trim(), planted_detail: document.getElementById('editFsPlanted').value.trim(), expected_resolution: document.getElementById('editFsResolution').value.trim(), status: document.getElementById('editFsStatus').value, priority: parseInt(document.getElementById('editFsPriority').value) || 5, notes: document.getElementById('editFsNotes').value.trim() } });
    closeModal(event); toast('已保存', 'success'); loadForeshadows();
}

async function deleteForeshadow(id) { if (!confirm('确定删除？')) return; await api(`/novels/${currentNovelId}/foreshadows/${id}`, { method: 'DELETE' }); closeModal(event); toast('已删除', 'success'); loadForeshadows(); }

// ═══════════════════════════════════════════
// Writing & AI
// ═══════════════════════════════════════════
async function loadWritingView() {
    const chapters = await api(`/novels/${currentNovelId}/chapters`);
    const s = document.getElementById('chapterSelect');
    s.innerHTML = '<option value="">— 选择章节 —</option>';
    chapters.forEach(ch => s.innerHTML += `<option value="${ch.id}" ${ch.id===currentChapterId?'selected':''}>${esc(ch.title||`第 ${ch.id} 章`)} (${fmt(ch.word_count)}字)</option>`);
    // Load templates
    const templates = await api(`/novels/${currentNovelId}/templates`);
    const ts = document.getElementById('templateSelect');
    ts.innerHTML = '<option value="">自定义指令</option>';
    templates.forEach(t => ts.innerHTML += `<option value="${t.id}" ${t.is_builtin?'data-builtin="true"':''}>${esc(t.name)}${t.is_builtin?' ⭐':''}</option>`);
    if (currentChapterId) loadChapter(currentChapterId);
}

function applyTemplate(tplId) {
    if (!tplId) return;
    const sel = document.getElementById('templateSelect');
    const opt = sel.options[sel.selectedIndex];
    if (opt.dataset.builtin === 'true') {
        // Fetch template content from the list
        api(`/novels/${currentNovelId}/templates`).then(templates => {
            const t = templates.find(x => x.id === parseInt(tplId));
            if (t) document.getElementById('aiPrompt').value = t.prompt_template;
        });
    } else {
        api(`/novels/${currentNovelId}/templates`).then(templates => {
            const t = templates.find(x => x.id === parseInt(tplId));
            if (t) document.getElementById('aiPrompt').value = t.prompt_template;
        });
    }
}

function showCreateChapter() {
    showModal(`<h3>创建新章节</h3><div class="form-group"><label>章节标题</label><input type="text" id="newChapterTitle" class="input" autofocus></div><div class="modal-actions"><button class="btn" onclick="closeModal(event)">取消</button><button class="btn btn-primary" onclick="createChapter()">创建</button></div>`);
}

async function createChapter() {
    const title = document.getElementById('newChapterTitle').value.trim();
    const ch = await api(`/novels/${currentNovelId}/chapters`, { method: 'POST', body: { title: title || `第 ${Date.now()%1000} 章` } });
    closeModal(event); toast('已创建', 'success'); currentChapterId = ch.id; loadWritingView();
}

async function loadChapter(id) {
    if (!id) { document.getElementById('chapterEditor').style.display = 'none'; currentChapterId = null; return; }
    currentChapterId = parseInt(id);
    const ch = await api(`/novels/${currentNovelId}/chapters/${id}`);
    document.getElementById('chapterEditor').style.display = 'flex';
    document.getElementById('chapterTitle').value = ch.title || '';
    document.getElementById('chapterContent').value = ch.content || '';
    document.getElementById('chapterWordCount').textContent = `${fmt(ch.word_count)} 字`;
    document.getElementById('chapterVersion').textContent = `v${ch.version}`;
    document.getElementById('chapterStatus').textContent = statusLabel(ch.status);
    document.getElementById('chapterStatus').className = `status-badge ${ch.status}`;
    document.getElementById('chapterSelect').value = id;
    updatePreview();
}

function autoSaveChapter() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
        if (!currentChapterId) return;
        const content = document.getElementById('chapterContent').value;
        document.getElementById('chapterWordCount').textContent = `${fmt(countWords(content))} 字`;
        updatePreview();
        try { await api(`/novels/${currentNovelId}/chapters/${currentChapterId}`, { method: 'PUT', body: { content } }); } catch(e) {}
    }, 1000);
}

async function saveChapterTitle() {
    if (!currentChapterId) return;
    await api(`/novels/${currentNovelId}/chapters/${currentChapterId}`, { method: 'PUT', body: { title: document.getElementById('chapterTitle').value.trim() } });
    loadWritingView();
}

// ─── Markdown Editor ───
function insertFormat(before, after) {
    const ta = document.getElementById('chapterContent');
    const start = ta.selectionStart, end = ta.selectionEnd;
    const sel = ta.value.substring(start, end);
    const replacement = before + (sel || '文本') + after;
    ta.value = ta.value.substring(0, start) + replacement + ta.value.substring(end);
    ta.selectionStart = start + before.length;
    ta.selectionEnd = start + before.length + (sel || '文本').length;
    ta.focus();
    autoSaveChapter();
}

function togglePreviewMode() {
    isPreviewMode = !isPreviewMode;
    const ta = document.getElementById('chapterContent');
    const pv = document.getElementById('chapterPreview');
    const btn = document.getElementById('previewToggle');
    if (isPreviewMode) {
        pv.style.display = 'block'; ta.style.display = 'none'; btn.classList.add('active');
        updatePreview();
    } else {
        pv.style.display = 'none'; ta.style.display = 'block'; btn.classList.remove('active');
    }
}

function updatePreview() {
    if (!isPreviewMode) return;
    const content = document.getElementById('chapterContent').value;
    document.getElementById('chapterPreview').innerHTML = marked.parse(content || '');
}

function toggleFullscreen() {
    document.querySelector('.writing-layout').classList.toggle('fullscreen');
}

// ─── Version History ───
function showVersionHistory() {
    if (!currentChapterId) { toast('请先选择章节', 'error'); return; }
    api(`/novels/${currentNovelId}/chapters/${currentChapterId}/versions`).then(versions => {
        const currentV = versions.length ? versions[0].version_number : 1;
        showModal(`<h3>版本历史</h3>
            <div style="margin-bottom:16px;display:flex;gap:8px">
                <button class="btn btn-sm btn-primary" onclick="saveVersion()">💾 保存当前版本</button>
            </div>
            <div class="version-list">${versions.length ? versions.map(v => `<div class="version-item ${v.version_number===currentV?'current':''}"><div class="version-meta"><span class="version-num">v${v.version_number}</span><span class="version-summary">${esc(v.change_summary||'无备注')}</span></div><div class="version-info-side"><span>${fmt(v.word_count)} 字</span><span>${new Date(v.created_at).toLocaleString('zh-CN')}</span><button class="btn btn-sm btn-outline" onclick="restoreVersion(${v.id})">回滚</button></div></div>`).join('') : '<div class="empty-state"><div class="empty-state-text">还没有历史版本</div></div>'}</div>
            <div class="modal-actions"><button class="btn" onclick="closeModal(event)">关闭</button></div>`);
    });
}

async function saveVersion() {
    const summary = prompt('版本备注（可选）：') || '';
    await api(`/novels/${currentNovelId}/chapters/${currentChapterId}/versions/save?change_summary=${encodeURIComponent(summary)}`, { method: 'POST' });
    toast('版本已保存', 'success');
    loadChapter(currentChapterId);
    showVersionHistory();
}

async function restoreVersion(versionId) {
    if (!confirm('确定回滚到此版本？当前内容会自动备份。')) return;
    await api(`/novels/${currentNovelId}/chapters/${currentChapterId}/versions/${versionId}/restore`, { method: 'POST' });
    toast('已回滚', 'success');
    loadChapter(currentChapterId);
    closeModal(event);
}

// ─── AI Write ───
async function previewContext() {
    if (!currentNovelId) return;
    const result = await api(`/novels/${currentNovelId}/ai-write/preview-context`, { method: 'POST', body: { chapter_id: currentChapterId || undefined, prompt: document.getElementById('aiPrompt').value, custom_context: document.getElementById('aiCustomContext').value, prev_chapter_count: parseInt(document.getElementById('aiPrevChapters').value) || 0 } });
    document.getElementById('contextPreview').style.display = 'block';
    document.getElementById('contextPreviewContent').textContent = result.context;
    document.getElementById('contextCharCount').textContent = `${result.char_count} 字符`;
    document.getElementById('contextTokenEst').textContent = `~${result.token_estimate} tokens`;
}

async function callAIWrite() {
    if (!currentNovelId) return;
    const btn = document.getElementById('aiWriteBtn');
    btn.disabled = true; btn.textContent = '生成中...';
    toast('正在生成...', 'info');
    try {
        const result = await api(`/novels/${currentNovelId}/ai-write`, { method: 'POST', body: { chapter_id: currentChapterId || undefined, prompt: document.getElementById('aiPrompt').value, custom_context: document.getElementById('aiCustomContext').value, prev_chapter_count: parseInt(document.getElementById('aiPrevChapters').value) || 0 } });
        if (result.success) {
            lastAIResult = result.content;
            document.getElementById('aiResult').style.display = 'block';
            document.getElementById('aiResultContent').textContent = result.content;
            toast('生成完成', 'success');
        } else { toast(result.error || '生成失败', 'error'); }
    } catch(e) { toast(e.message, 'error'); }
    btn.disabled = false; btn.textContent = '✨ AI 生成';
}

function acceptAIResult() {
    if (!lastAIResult || !currentChapterId) return;
    document.getElementById('chapterContent').value = lastAIResult;
    autoSaveChapter(); document.getElementById('aiResult').style.display = 'none'; lastAIResult = '';
    toast('已采纳', 'success');
}

function appendAIResult() {
    if (!lastAIResult || !currentChapterId) return;
    const ta = document.getElementById('chapterContent');
    const ex = ta.value.trim();
    ta.value = ex ? ex + '\n\n' + lastAIResult : lastAIResult;
    autoSaveChapter(); document.getElementById('aiResult').style.display = 'none'; lastAIResult = '';
    toast('已追加', 'success');
}

function discardAIResult() { document.getElementById('aiResult').style.display = 'none'; lastAIResult = ''; }

// ═══════════════════════════════════════════
// AI Config
// ═══════════════════════════════════════════
async function loadAIConfig() {
    const c = await api(`/novels/${currentNovelId}/ai-config`);
    document.getElementById('aiProvider').value = c.provider;
    document.getElementById('aiApiUrl').value = c.api_url;
    document.getElementById('aiApiKey').value = '';
    document.getElementById('aiModel').value = c.model;
    document.getElementById('aiSystemPrompt').value = c.system_prompt;
    document.getElementById('aiTemperature').value = c.temperature;
    document.getElementById('aiMaxTokens').value = c.max_tokens;
    document.getElementById('aiContextBudget').value = c.context_budget || 6000;
    document.getElementById('aiContextStrategy').value = c.context_strategy;
}

async function saveAIConfig() {
    const body = { provider: document.getElementById('aiProvider').value, api_url: document.getElementById('aiApiUrl').value, model: document.getElementById('aiModel').value, system_prompt: document.getElementById('aiSystemPrompt').value, temperature: parseFloat(document.getElementById('aiTemperature').value), max_tokens: parseInt(document.getElementById('aiMaxTokens').value), context_budget: parseInt(document.getElementById('aiContextBudget').value) || 6000, context_strategy: document.getElementById('aiContextStrategy').value };
    const key = document.getElementById('aiApiKey').value.trim();
    if (key) body.api_key = key;
    await api(`/novels/${currentNovelId}/ai-config`, { method: 'PUT', body });
    toast('设置已保存', 'success');
}

// ═══════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function fmt(n) { return n ? n.toLocaleString('zh-CN') : '0'; }
function statusLabel(s) { return { planned:'计划中', writing:'写作中', done:'已完成', draft:'草稿', revised:'修订中', final:'定稿', setup:'铺垫中', developing:'发展中', climax:'高潮', resolved:'已解决', abandoned:'已放弃', planted:'已埋设', partially_revealed:'部分揭示' }[s] || s; }
function countWords(t) { if (!t) return 0; let c = 0; for (const ch of t) { if ('\u4e00'<=ch<='\u9fff') c++; } const w = t.match(/[a-zA-Z]+/g); return c + (w ? w.length : 0); }
