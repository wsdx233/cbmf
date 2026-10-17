// DOM 元素引用
const baseUrlEl = document.getElementById('baseUrl');
const apiKeyEl = document.getElementById('apiKey');
const providerTypeEl = document.getElementById('providerType');
const modelIdEl = document.getElementById('modelId');
const reasoningPresetEl = document.getElementById('reasoningPreset');
const customReasoningWrap = document.getElementById('customReasoningWrap');
const customReasoningEffortEl = document.getElementById('customReasoningEffort');
const colorPromptEl = document.getElementById('colorPrompt');
const colorCountEl = document.getElementById('colorCount');
const repeatCountEl = document.getElementById('repeatCount');
const autoSortSwitch = document.getElementById('autoSortSwitch');
const commonColorSwitch = document.getElementById('commonColorSwitch');
const startBtn = document.getElementById('startBtn');
const exportBtn = document.getElementById('exportBtn');
const paletteBoard = document.getElementById('paletteBoard');
const exportCanvas = document.getElementById('exportCanvas');
const snackbarEl = document.getElementById('snackbar');

// 本地配置持久化
const STORAGE_KEY = 'COLOR_FINGERPRINT_CONFIG';
const PRESETS_KEY = 'COLOR_FINGERPRINT_PRESETS';
let autoSortEnabled = false;
let commonColorEnabled = false;
let activePresetId = '';

// 读取当前表单配置
function readFormConfig() {
    return {
        baseUrl: baseUrlEl.value.trim(),
        apiKey: apiKeyEl.value.trim(),
        providerType: providerTypeEl.value,
        modelId: modelIdEl.value.trim(),
        reasoningPreset: reasoningPresetEl.value,
        customReasoningEffort: customReasoningEffortEl.value,
        colorPrompt: colorPromptEl.value.trim(),
        colorCount: colorCountEl.value,
        repeatCount: repeatCountEl.value,
        autoSort: autoSortEnabled,
        commonColor: commonColorEnabled,
        presetId: activePresetId
    };
}

// 将配置写回表单
function applyFormConfig(cfg) {
    baseUrlEl.value = cfg.baseUrl || '';
    apiKeyEl.value = cfg.apiKey || '';
    setSelectValue(providerTypeEl, cfg.providerType, 'chat');
    modelIdEl.value = cfg.modelId || '';
    setSelectValue(reasoningPresetEl, cfg.reasoningPreset, 'none');
    customReasoningEffortEl.value = cfg.customReasoningEffort || '';
    colorPromptEl.value = cfg.colorPrompt || '逻辑的颜色';
    colorCountEl.value = cfg.colorCount || 16;
    repeatCountEl.value = cfg.repeatCount || 4;
    setAutoSort(cfg.autoSort === true);
    setCommonColor(cfg.commonColor === true);
    activePresetId = cfg.presetId || '';
    toggleReasoningInput();
    syncCustomSelects();
}

function setSelectValue(select, value, fallback) {
    select.value = value;
    if (select.selectedIndex < 0 || !select.value) select.value = fallback;
}

function loadConfig() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
        applyFormConfig(JSON.parse(saved));
    } catch (e) {
        console.error("加载配置失败", e);
    }
}

function saveConfig() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readFormConfig()));
}

// 预设读写
function readPresets() {
    try {
        const list = JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]');
        return Array.isArray(list) ? list.filter(p => p && p.id && p.name) : [];
    } catch (e) {
        console.error("读取预设失败", e);
        return [];
    }
}

function writePresets(list) {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
}

function makePresetId() {
    return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// MD3 Snackbar
let snackbarTimer = null;
function showSnackbar(message) {
    snackbarEl.textContent = message;
    snackbarEl.classList.add('show');
    clearTimeout(snackbarTimer);
    snackbarTimer = setTimeout(() => snackbarEl.classList.remove('show'), 2600);
}

// 自动排序开关
function setAutoSort(enabled) {
    autoSortEnabled = enabled;
    autoSortSwitch.setAttribute('aria-checked', String(enabled));
}

autoSortSwitch.addEventListener('click', () => {
    setAutoSort(!autoSortEnabled);
    sortDisplayedRows();
    saveConfig();
});

// 共有色开关：追加一行出现在超过一半组中的颜色（始终自动排序）
function setCommonColor(enabled) {
    commonColorEnabled = enabled;
    commonColorSwitch.setAttribute('aria-checked', String(enabled));
}

commonColorSwitch.addEventListener('click', () => {
    setCommonColor(!commonColorEnabled);
    renderCommonRow({ animate: false });
    saveConfig();
});

/* ---------- MD3 自定义下拉 ---------- */
const mdSelects = [];
let activeMdMenu = null;

function closeActiveMdMenu() {
    if (!activeMdMenu) return;
    activeMdMenu.menu.classList.remove('show');
    activeMdMenu.wrap.classList.remove('open');
    activeMdMenu.trigger.setAttribute('aria-expanded', 'false');
    activeMdMenu = null;
}

function initMdSelect(wrap) {
    const trigger = wrap.querySelector('.md-select-trigger');
    const select = wrap.querySelector('select');
    const valueEl = wrap.querySelector('.md-select-value');
    const menu = document.createElement('div');
    menu.className = 'md-menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;
    document.body.appendChild(menu);

    const api = { wrap, trigger, select, menu, valueEl, sync, reposition: placeMenu, close: closeMenu };

    function sync() {
        if (select.selectedIndex < 0) select.selectedIndex = 0;
        const opt = select.options[select.selectedIndex];
        valueEl.textContent = opt ? opt.textContent.trim() : '';
        Array.from(menu.children).forEach((item, i) => {
            item.setAttribute('aria-selected', String(i === select.selectedIndex));
        });
    }

    function placeMenu() {
        const rect = trigger.getBoundingClientRect();
        menu.hidden = false;
        menu.style.minWidth = `${Math.max(rect.width, 200)}px`;
        const menuH = Math.min(menu.offsetHeight, 320);
        const gap = 8;
        const openUp = rect.bottom + gap + menuH > window.innerHeight && rect.top > menuH + gap;
        menu.style.top = openUp ? `${rect.top - menuH - gap}px` : `${rect.bottom + gap}px`;
        menu.style.transformOrigin = openUp ? 'bottom center' : 'top center';
        menu.style.left = `${Math.min(Math.max(rect.left, 8), window.innerWidth - menu.offsetWidth - 8)}px`;
    }

    function openMenu() {
        if (activeMdMenu && activeMdMenu !== api) closeActiveMdMenu();
        populate();
        placeMenu();
        menu.classList.add('show');
        wrap.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        activeMdMenu = api;
    }

    function populate() {
        menu.innerHTML = '';
        Array.from(select.options).forEach((opt, i) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'md-menu-item';
            item.setAttribute('role', 'option');
            item.tabIndex = -1;
            item.textContent = opt.textContent.trim();
            item.addEventListener('click', () => {
                select.selectedIndex = i;
                sync();
                trigger.focus();
                select.dispatchEvent(new Event('change', { bubbles: true }));
                closeMenu();
            });
            menu.appendChild(item);
        });
        sync();
    }

    function closeMenu() {
        menu.classList.remove('show');
        wrap.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        if (activeMdMenu === api) activeMdMenu = null;
    }

    trigger.addEventListener('click', () => {
        if (activeMdMenu === api) closeMenu();
        else openMenu();
    });

    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            openMenu();
            const items = Array.from(menu.children);
            const target = select.selectedIndex >= 0 ? select.selectedIndex : 0;
            items[target]?.focus();
        } else if (e.key === 'Escape') {
            closeMenu();
        }
    });

    menu.addEventListener('keydown', (e) => {
        const items = Array.from(menu.children);
        const index = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            items[Math.min(index + 1, items.length - 1)]?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            items[Math.max(index - 1, 0)]?.focus();
        } else if (e.key === 'Home') {
            e.preventDefault();
            items[0]?.focus();
        } else if (e.key === 'End') {
            e.preventDefault();
            items[items.length - 1]?.focus();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeMenu();
            trigger.focus();
        } else if (e.key === 'Tab') {
            closeMenu();
        }
    });

    mdSelects.push(api);
    sync();
    return api;
}

document.querySelectorAll('[data-md-select]').forEach(initMdSelect);

function syncCustomSelects() {
    mdSelects.forEach(api => api.sync());
}

document.addEventListener('pointerdown', (e) => {
    if (!activeMdMenu) return;
    if (activeMdMenu.wrap.contains(e.target) || activeMdMenu.menu.contains(e.target)) return;
    closeActiveMdMenu();
});

window.addEventListener('resize', closeActiveMdMenu);
document.addEventListener('scroll', (e) => {
    if (!activeMdMenu) return;
    if (activeMdMenu.menu.contains(e.target)) return;
    activeMdMenu.reposition();
}, true);
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (activeMdMenu) {
        closeActiveMdMenu();
        return;
    }
    const top = dialogStack[dialogStack.length - 1];
    if (top) closeDialog(top);
});

/* ---------- MD3 弹窗 ---------- */
const dialogStack = [];

function openDialog(el) {
    closeActiveMdMenu();
    const previous = dialogStack[dialogStack.length - 1];
    if (previous && previous !== el) previous.inert = true;
    el.classList.add('show');
    el.removeAttribute('aria-hidden');
    el.inert = false;
    if (!dialogStack.includes(el)) dialogStack.push(el);
    const target = el.querySelector('[data-autofocus]') ||
        el.querySelector('input, .preset-load, button:not([data-dialog-close])');
    setTimeout(() => { if (dialogStack.includes(el) && dialogStack[dialogStack.length - 1] === el) target?.focus(); }, 60);
}

function closeDialog(el) {
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
    el.inert = true;
    const index = dialogStack.indexOf(el);
    if (index !== -1) dialogStack.splice(index, 1);
    const top = dialogStack[dialogStack.length - 1];
    if (top) top.inert = false;
}

document.querySelectorAll('.dialog-scrim').forEach(scrim => {
    scrim.addEventListener('pointerdown', (e) => {
        if (e.target === scrim) closeDialog(scrim);
    });
    scrim.querySelectorAll('[data-dialog-close]').forEach(btn => {
        btn.addEventListener('click', () => closeDialog(scrim));
    });
});

/* ---------- 预设管理 ---------- */
const savePresetDialog = document.getElementById('savePresetDialog');
const presetListDialog = document.getElementById('presetListDialog');
const renamePresetDialog = document.getElementById('renamePresetDialog');
const confirmDialog = document.getElementById('confirmDialog');
const presetNameInput = document.getElementById('presetNameInput');
const presetListEl = document.getElementById('presetList');
const renamePresetInput = document.getElementById('renamePresetInput');
const confirmMessageEl = document.getElementById('confirmMessage');
const aboutDialog = document.getElementById('aboutDialog');
let renameTargetId = null;
let confirmAction = null;

function providerSummary(cfg) {
    return [cfg.providerType || 'chat', cfg.modelId].filter(Boolean).join(' · ');
}

function renderPresetList() {
    const presets = readPresets();
    presetListEl.innerHTML = '';

    if (presets.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'preset-empty';
        empty.innerHTML = '还没有保存的预设。<br>点击右上角保存按钮创建第一个接口预设。';
        presetListEl.appendChild(empty);
        return;
    }

    presets.forEach(preset => {
        const item = document.createElement('div');
        item.className = 'preset-item';
        item.dataset.id = preset.id;

        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.className = 'preset-load';
        loadBtn.title = `读取「${preset.name}」`;

        const meta = document.createElement('div');
        meta.className = 'preset-meta';
        const name = document.createElement('div');
        name.className = 'preset-name';
        name.textContent = preset.name;
        const sub = document.createElement('div');
        sub.className = 'preset-sub';
        sub.textContent = providerSummary(preset.config || {});
        meta.append(name, sub);
        loadBtn.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'preset-actions';

        const renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = 'icon-btn';
        renameBtn.title = '重命名';
        renameBtn.setAttribute('aria-label', `重命名 ${preset.name}`);
        renameBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>';
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            renameTargetId = preset.id;
            renamePresetInput.value = preset.name;
            openDialog(renamePresetDialog);
            renamePresetInput.select();
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'icon-btn';
        deleteBtn.title = '删除';
        deleteBtn.setAttribute('aria-label', `删除 ${preset.name}`);
        deleteBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmMessageEl.textContent = `确定删除预设「${preset.name}」吗？此操作无法撤销。`;
            confirmAction = () => {
                writePresets(readPresets().filter(p => p.id !== preset.id));
                renderPresetList();
                showSnackbar(`已删除预设「${preset.name}」`);
            };
            openDialog(confirmDialog);
        });

        actions.append(renameBtn, deleteBtn);

        const load = () => {
            applyFormConfig(preset.config || {});
            activePresetId = preset.id;
            saveConfig();
            closeDialog(presetListDialog);
            showSnackbar(`已读取预设「${preset.name}」`);
        };
        loadBtn.addEventListener('click', load);

        item.append(loadBtn, actions);
        presetListEl.appendChild(item);
    });
}

document.getElementById('saveConfigBtn').addEventListener('click', () => {
    presetNameInput.value = '';
    openDialog(savePresetDialog);
});

document.getElementById('loadConfigBtn').addEventListener('click', () => {
    renderPresetList();
    openDialog(presetListDialog);
});

document.getElementById('aboutBtn').addEventListener('click', () => {
    openDialog(aboutDialog);
});

document.getElementById('confirmSavePreset').addEventListener('click', () => {
    const name = presetNameInput.value.trim();
    if (!name) {
        showSnackbar('请输入预设名称');
        presetNameInput.focus();
        return;
    }

    const cfg = readFormConfig();
    delete cfg.presetId;
    const presets = readPresets();
    const existing = presets.find(p => p.name === name);
    if (existing) {
        existing.config = cfg;
        writePresets(presets);
        activePresetId = existing.id;
        showSnackbar(`已更新预设「${name}」`);
    } else {
        const id = makePresetId();
        presets.push({ id, name, config: cfg });
        writePresets(presets);
        activePresetId = id;
        showSnackbar(`已保存预设「${name}」`);
    }

    saveConfig();
    closeDialog(savePresetDialog);
});

document.getElementById('confirmRenamePreset').addEventListener('click', () => {
    const name = renamePresetInput.value.trim();
    if (!name) {
        showSnackbar('请输入预设名称');
        renamePresetInput.focus();
        return;
    }
    const presets = readPresets();
    if (presets.some(p => p.id !== renameTargetId && p.name === name)) {
        showSnackbar('已存在同名预设');
        renamePresetInput.select();
        return;
    }
    const target = presets.find(p => p.id === renameTargetId);
    if (target) {
        target.name = name;
        writePresets(presets);
        renderPresetList();
        showSnackbar(`已重命名为「${name}」`);
    }
    closeDialog(renamePresetDialog);
});

document.getElementById('confirmOk').addEventListener('click', () => {
    const action = confirmAction;
    confirmAction = null;
    closeDialog(confirmDialog);
    action?.();
});

presetNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('confirmSavePreset').click();
    }
});

renamePresetInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('confirmRenamePreset').click();
    }
});

// 思考强度切换
reasoningPresetEl.addEventListener('change', toggleReasoningInput);
function toggleReasoningInput() {
    customReasoningWrap.hidden = reasoningPresetEl.value !== 'custom';
}

// 存储本次所有生成的色彩矩阵 (二维数组: row -> hex[])
let generatedMatrix = [];

// 色彩值排序（按 HEX 数值升序，同值保持原顺序）
function hexSortValue(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const num = parseInt(h, 16);
    return Number.isNaN(num) ? Infinity : num;
}

function sortedRow(row) {
    return row
        .map((hex, index) => ({ hex, index }))
        .sort((a, b) => hexSortValue(a.hex) - hexSortValue(b.hex) || a.index - b.index)
        .map(item => item.hex);
}

function displayRow(index) {
    const row = generatedMatrix[index] || [];
    return autoSortEnabled ? sortedRow(row) : row.slice();
}

function buildColorBlock(hex, { animate = true } = {}) {
    const block = document.createElement('div');
    block.className = 'color-block';
    block.style.backgroundColor = hex;
    block.style.color = hex; // 供 currentColor 缝隙补丁使用
    block.title = hex;
    block.dataset.hex = hex;
    if (!animate) {
        block.style.animation = 'none';
        block.style.opacity = '1';
        block.style.transform = 'none';
    }
    // 动画结束后清掉 transform/动画层，避免合成层继续产生亚像素白缝
    block.addEventListener('animationend', () => {
        block.style.animation = 'none';
        block.style.opacity = '1';
        block.style.transform = 'none';
    }, { once: true });
    return block;
}

// 流式追加：开启自动排序时插入到正确位置
function insertSortedBlock(rowEl, hex) {
    const block = buildColorBlock(hex);
    const value = hexSortValue(hex);
    const next = Array.from(rowEl.children).find(el => hexSortValue(el.dataset.hex) > value);
    if (next) rowEl.insertBefore(block, next);
    else rowEl.appendChild(block);
}

function appendColorBlock(rowEl, hex) {
    if (!autoSortEnabled) {
        rowEl.appendChild(buildColorBlock(hex));
        return;
    }
    insertSortedBlock(rowEl, hex);
}

function renderRow(index, { animate = true } = {}) {
    const rowEl = document.getElementById(`palette-row-${index}`);
    if (!rowEl) return;
    rowEl.innerHTML = '';
    displayRow(index).forEach(hex => {
        rowEl.appendChild(buildColorBlock(hex, { animate }));
    });
}

function sortDisplayedRows() {
    if (generatedMatrix.length === 0) return;
    generatedMatrix.forEach((_, index) => renderRow(index, { animate: false }));
}

// 共有色：出现在超过一半组中的颜色（忽略大小写），始终按色彩值升序
function commonColors() {
    const rows = generatedMatrix;
    if (rows.length === 0) return [];

    const counts = new Map();
    rows.forEach(row => {
        new Set(row.map(hex => hex.toUpperCase())).forEach(hex => {
            counts.set(hex, (counts.get(hex) || 0) + 1);
        });
    });

    const threshold = rows.length / 2;
    return Array.from(counts.entries())
        .filter(([, count]) => count > threshold)
        .map(([hex]) => hex)
        .sort((a, b) => hexSortValue(a) - hexSortValue(b));
}

const COMMON_ROW_ID = 'palette-row-common';

function removeCommonRow() {
    document.getElementById(COMMON_ROW_ID)?.remove();
}

function renderCommonRow({ animate = false } = {}) {
    const rowEl = document.getElementById(COMMON_ROW_ID);
    if (!commonColorEnabled) {
        removeCommonRow();
        return;
    }
    const colors = commonColors();
    if (colors.length === 0) {
        removeCommonRow();
        return;
    }
    const target = rowEl || document.createElement('div');
    target.className = 'palette-row palette-row-common';
    target.id = COMMON_ROW_ID;
    target.title = '共有色';
    target.innerHTML = '';
    colors.forEach(hex => {
        target.appendChild(buildColorBlock(hex, { animate }));
    });
    if (!rowEl) paletteBoard.appendChild(target);
}

// 流式过程中合并刷新，避免每个色块都重建共有色行
let commonRowFrame = 0;
function scheduleCommonRowUpdate() {
    if (!commonColorEnabled || commonRowFrame) return;
    commonRowFrame = requestAnimationFrame(() => {
        commonRowFrame = 0;
        renderCommonRow({ animate: false });
    });
}

// 构建请求 Payload
function createPayload(provider, model, promptText, count) {
    const systemPrompt = `你是一个色彩提取引擎。请根据用户需求生成严格由十六进制色彩HEX组成的JSON数组，包含准确的${count}个颜色。格式范例：["#A1B2C3", "#FFFFFF"]。除了纯JSON格式数据本身外，严禁输出任何解释、注释、Markdown标签或无意义文字。`;
    const reasoningMode = reasoningPresetEl.value;
    const customVal = customReasoningEffortEl.value;

    if (provider === 'chat') {
        const body = {
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: promptText }
            ],
            stream: true
        };
        if (reasoningMode !== 'none') {
            body.reasoning_effort = reasoningMode === 'custom' ? Number(customVal) || customVal : reasoningMode;
        }
        return { url: `${baseUrlEl.value.replace(/\/+$/, '')}/chat/completions`, body };
    } 
    
    if (provider === 'response') {
        const body = {
            model: model,
            input: `${systemPrompt}\n\n需求：${promptText}`,
            stream: true
        };
        if (reasoningMode !== 'none') {
            body.reasoning = {
                effort: reasoningMode === 'custom' ? Number(customVal) || customVal : reasoningMode
            };
        }
        return { url: `${baseUrlEl.value.replace(/\/+$/, '')}/responses`, body };
    }

    if (provider === 'message') {
        const body = {
            model: model,
            system: systemPrompt,
            messages: [
                { role: "user", content: promptText }
            ],
            max_tokens: 4096,
            stream: true
        };
        if (reasoningMode !== 'none') {
            const budget = reasoningMode === 'custom' ? Number(customVal) : 2048;
            body.thinking = { type: "enabled", budget_tokens: budget };
        }
        return { url: `${baseUrlEl.value.replace(/\/+$/, '')}/v1/messages`, body };
    }
}

// 通用 Stream 行读取与增量色彩捕捉
async function runSingleStream(totalCount, onColorFound) {
    const provider = providerTypeEl.value;
    const model = modelIdEl.value.trim();
    const prompt = `生成 ${totalCount} 个颜色：${colorPromptEl.value.trim()}`;
    const { url, body } = createPayload(provider, model, prompt, totalCount);

    const headers = {
        'Content-Type': 'application/json'
    };
    const apiKey = apiKeyEl.value.trim();
    if (provider === 'message') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
    } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`请求失败: ${response.status} - ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let rawAccumulated = '';
    let capturedColors = [];

    // 正则实时捕获 3 位或 6 位 Hex 颜色
    const hexRegex = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop(); // 保留不完整分片

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;
            if (trimmed === 'data: [DONE]') continue;

            let dataContent = '';
            if (trimmed.startsWith('data: ')) {
                dataContent = trimmed.substring(6);
            } else if (provider === 'response') {
                dataContent = trimmed;
            }

            try {
                const parsed = JSON.parse(dataContent);
                let token = '';

                if (provider === 'chat') {
                    token = parsed.choices?.[0]?.delta?.content || '';
                } else if (provider === 'response') {
                    token = parsed.delta || parsed.output_text_delta || '';
                } else if (provider === 'message') {
                    if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                        token = parsed.delta.text || '';
                    }
                }

                if (token) {
                    rawAccumulated += token;
                    let match;
                    while ((match = hexRegex.exec(rawAccumulated)) !== null) {
                        const hex = match[0].toUpperCase();
                        if (capturedColors.length < totalCount) {
                            // 仅当新捕获时追加
                            if (capturedColors.indexOf(match.index) === -1) {
                                capturedColors.push(match.index);
                                onColorFound(hex);
                            }
                        }
                    }
                }
            } catch (e) {
                // 忽略非 JSON 行
            }
        }
    }
}

// 开始执行测试
startBtn.addEventListener('click', async () => {
    saveConfig();
    const repeats = parseInt(repeatCountEl.value) || 1;
    const count = parseInt(colorCountEl.value) || 16;

    if (!modelIdEl.value.trim() || !baseUrlEl.value.trim()) {
        alert('请填写 Base URL 和 Model ID');
        return;
    }

    // 初始化状态与面板
    paletteBoard.innerHTML = '';
    generatedMatrix = Array.from({ length: repeats }, () => []);
    startBtn.disabled = true;
    exportBtn.disabled = true;

    // 创建行结构
    for (let i = 0; i < repeats; i++) {
        const row = document.createElement('div');
        row.className = 'palette-row';
        row.id = `palette-row-${i}`;
        paletteBoard.appendChild(row);
    }

    // 并发启动流
    const tasks = Array.from({ length: repeats }, (_, i) => {
        const rowEl = document.getElementById(`palette-row-${i}`);
        return runSingleStream(count, (hex) => {
            generatedMatrix[i].push(hex);
            appendColorBlock(rowEl, hex);
            scheduleCommonRowUpdate();
        }).catch(err => {
            console.error(`第 ${i + 1} 组失败:`, err);
            rowEl.style.outline = '2px dashed red';
        });
    });

    await Promise.allSettled(tasks);
    startBtn.disabled = false;
    exportBtn.disabled = false;
});

// 导出文件名：预设名称（无预设则 fingerprint）- 模型 ID - 时间戳
function sanitizeFilePart(value) {
    return String(value || '')
        .replace(/[\\/:*?"<>|\x00-\x1f]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[. ]+$/, '');
}

function buildExportFileName() {
    const preset = readPresets().find(p => p.id === activePresetId);
    const prefix = sanitizeFilePart(preset?.name) || 'fingerprint';
    const model = sanitizeFilePart(modelIdEl.value.trim());
    return [prefix, model, Date.now()].filter(Boolean).join('-') + '.png';
}

// 导出纯净色块拼图（无文本、无间隙）
exportBtn.addEventListener('click', () => {
    const validRows = generatedMatrix
        .map((_, index) => displayRow(index))
        .filter(row => row.length > 0);
    if (commonColorEnabled) {
        const common = commonColors();
        if (common.length > 0) validRows.push(common);
    }
    if (validRows.length === 0) return;

    const blockWidth = 80;
    const blockHeight = 80;
    const maxCols = Math.max(...validRows.map(r => r.length));

    exportCanvas.width = maxCols * blockWidth;
    exportCanvas.height = validRows.length * blockHeight;

    const ctx = exportCanvas.getContext('2d');
    ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);

    validRows.forEach((row, rowIndex) => {
        row.forEach((hex, colIndex) => {
            ctx.fillStyle = hex;
            ctx.fillRect(colIndex * blockWidth, rowIndex * blockHeight, blockWidth, blockHeight);
        });
    });

    const link = document.createElement('a');
    link.download = buildExportFileName();
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
});

// 页面初始化
loadConfig();
