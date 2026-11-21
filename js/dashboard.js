//廢水處理index.html的負責主畫面卡片渲染
// js/dashboard.js

let lastSuccessfulUpdateText = null;

const DATA_UPLOAD_STALE_MS = 15 * 60 * 1000;

function updateDataUploadReminder(timestamp, fromCache) {
    const reminder = document.getElementById("dataUploadReminder");
    if (!reminder) return;

    const rawTimestamp = String(timestamp || "").trim();
    const normalizedTimestamp = rawTimestamp.replace(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+/, "$1-$2-$3T").replace(" ", "T");
    const timestampMs = Date.parse(normalizedTimestamp);
    if (!rawTimestamp || !Number.isFinite(timestampMs)) {
        reminder.style.display = "block";
        reminder.textContent = "⚠️ 目前無法確認廢水來源資料的更新時間。請環化課確認廢水主機上的 push_to_google.py 已開啟執行；停電復電後請重新啟動。";
        return;
    }

    const ageMs = Date.now() - timestampMs;
    if (ageMs <= DATA_UPLOAD_STALE_MS && ageMs >= -5 * 60 * 1000) {
        reminder.style.display = "none";
        reminder.textContent = "";
        return;
    }

    const elapsedMinutes = Math.max(0, Math.floor(ageMs / 60000));
    const cacheNote = fromCache ? "（目前畫面顯示快取資料）" : "";
    reminder.style.display = "block";
    reminder.textContent = "⚠️ 廢水來源資料已 " + elapsedMinutes + " 分鐘未更新，資料時間：" + rawTimestamp + "。" +
        cacheNote + "請環化課確認廢水主機上的 push_to_google.py 已開啟並持續執行；停電復電後請重新啟動。若程式已執行仍未更新，請檢查主機與試算表連線。";
}

const ALARM_SETTINGS_STORAGE_KEY = "wastewaterAlarmSettingsV1";

function readAlarmSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(ALARM_SETTINGS_STORAGE_KEY) || "{}");
        return saved && typeof saved === "object" ? saved : {};
    } catch (error) {
        console.warn("讀取卡片警報設定失敗", error);
        return {};
    }
}

function getAlarmRule(colName) {
    const saved = readAlarmSettings();
    if (saved[colName]) return { ...(ALARMS[colName] || {}), ...saved[colName] };
    return ALARMS[colName] || null;
}

function hasCustomAlarmRule(colName) {
    return Object.prototype.hasOwnProperty.call(readAlarmSettings(), colName);
}

function getNumberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function openCardSettings(card) {
    const colName = card.dataset.settingsCol;
    if (!colName) return;

    const saved = readAlarmSettings();
    const rule = getAlarmRule(colName) || {};
    const rawValue = window.currentDashboardData && window.currentDashboardData[colName];
    const value = getNumberOrNull(rawValue);
    const fallbackMax = value !== null && value > 0
        ? Math.max(100, Math.ceil(value * 1.25 / 10) * 10)
        : 100;
    const isPh = colName.indexOf("PHI") !== -1 && !hasCustomAlarmRule(colName);

    document.getElementById("cardSettingsCol").value = colName;
    document.getElementById("cardSettingsTitle").textContent =
        (card.dataset.settingsName || "監測卡片") + " 設定";
    document.getElementById("cardSettingsUnit").textContent =
        card.dataset.settingsUnit ? "單位：" + card.dataset.settingsUnit : "此項目無單位";
    document.getElementById("alarmMin").value = rule.min ?? 0;
    document.getElementById("alarmWarn").value = rule.warn ?? (isPh ? 6.5 : "");
    document.getElementById("alarmCrit").value = rule.crit ?? (isPh ? 9 : "");
    document.getElementById("alarmMax").value = rule.max ?? (isPh ? 14 : fallbackMax);
    document.getElementById("cardSettingsMessage").textContent =
        isPh
            ? "目前 pH 卡片另有既定的雙向警報判斷；儲存自訂設定後，將改依黃色與紅色門檻判斷。"
            : "黃色與紅色門檻需同時設定，留白可停用警報；系統會依門檻大小自動判斷高警報或低警報。設定保存在目前瀏覽器。";

    document.getElementById("cardSettingsModal").style.display = "block";
}

function closeCardSettings() {
    const modal = document.getElementById("cardSettingsModal");
    if (modal) modal.style.display = "none";
}

function handleCardSettingsKeydown(event, card) {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCardSettings(card);
    }
}

function saveCardSettings(event) {
    event.preventDefault();
    const colName = document.getElementById("cardSettingsCol").value;
    const min = getNumberOrNull(document.getElementById("alarmMin").value);
    const warn = getNumberOrNull(document.getElementById("alarmWarn").value);
    const crit = getNumberOrNull(document.getElementById("alarmCrit").value);
    const max = getNumberOrNull(document.getElementById("alarmMax").value);

    if (!colName || min === null || max === null || max <= min) {
        alert("請輸入有效的最小值與最大值，且最大值須大於最小值。");
        return;
    }
    if ((warn === null) !== (crit === null)) {
        alert("黃色警報值與紅色超限值請同時設定，或同時留白停用警報。");
        return;
    }
    if (warn !== null && (warn < min || warn > max || crit < min || crit > max || warn === crit)) {
        alert("警報門檻須落在最小值與最大值之間，且黃色與紅色門檻不可相同。");
        return;
    }

    const settings = readAlarmSettings();
    settings[colName] = { min, warn, crit, max };
    try {
        localStorage.setItem(ALARM_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
        alert("設定無法儲存，請檢查瀏覽器儲存空間。");
        return;
    }

    closeCardSettings();
    if (window.currentDashboardData) renderDashboard(window.currentDashboardData, false);
}


/**
 * 初始化儀表板
 * 1. 設定主題
 * 2. 設定報表日期預設值
 * 3. 啟動定時更新 (每 10 秒)
 */
function initDashboard() {
    // 載入儲存的主題設定
    if(localStorage.getItem('theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        document.getElementById('themeBtn').innerText = "☀️";
    } else {
        document.getElementById('themeBtn').innerText = "🌓";
    }

    // 設定報表預設月份 (當前月份)
    const reportInput = document.getElementById('waterReportMonth');
    if(reportInput) reportInput.value = getLocalYearMonth();

    // 先顯示上次成功資料，讓畫面不必等 API 回應才出現
    const cached = readDashboardCache();
    if (cached && cached.data) renderDashboard(cached.data, true);

    // 背景更新即時資料；避免慢回應時重複堆疊請求
    fetchData();
    if (!window.dashboardRefreshTimer) {
        window.dashboardRefreshTimer = setInterval(fetchData, 10000);
    }

    // 首次進入廢水處理頁面時，載入今日 T05-01 液位曲線。
    if (typeof initializeChart === 'function') initializeChart();
}

function startApp() {
    if(localStorage.getItem('theme') === 'dark') document.body.setAttribute('data-theme', 'dark');
    document.getElementById('themeBtn').innerText = localStorage.getItem('theme') === 'dark' ? "☀️" : "🌓";
    
    // 初始化日期預設為當月
    document.getElementById('waterReportMonth').value = getLocalYearMonth();

    setInterval(fetchData, 5000);
    fetchData();
}

/**
 * 從後端 API 抓取即時數據
 */
function readDashboardCache() {
    try {
        const raw = localStorage.getItem('wastewaterDashboardCacheV1');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.warn("讀取本機快取失敗", e);
        return null;
    }
}

/**
 * 從後端 API 抓取即時數據
 */
async function fetchData() {
    if (window.dashboardFetchInProgress) return;
    window.dashboardFetchInProgress = true;

    try {
        const response = await fetch(API_URL + "?mode=read&t=" + Date.now());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data || typeof data !== "object") throw new Error("資料格式錯誤");

        if(data.timestamp) {
            const timestampText = String(data.timestamp).trim();
            const timeMatch = timestampText.match(/(?:T|\s)(\d{2}:\d{2}(?::\d{2})?)/);
            lastSuccessfulUpdateText = timeMatch ? timeMatch[1] : timestampText;
        }
        try {
            localStorage.setItem('wastewaterDashboardCacheV1', JSON.stringify({
                data,
                savedAt: Date.now()
            }));
        } catch (e) {
            console.warn("儲存本機快取失敗", e);
        }
        renderDashboard(data, false);
    } catch (err) {
        console.error("Fetch error:", err);
        const lastUpdateLabel = document.getElementById('last-update');
        const cached = readDashboardCache();
        lastUpdateLabel.innerText = cached && lastSuccessfulUpdateText
            ? `連線異常｜顯示快取資料｜最後資料時間：${lastSuccessfulUpdateText}`
            : lastSuccessfulUpdateText
                ? `連線異常｜最後成功更新：${lastSuccessfulUpdateText}（畫面可能已過期）`
                : "連線異常｜尚無成功資料";
    } finally {
        window.dashboardFetchInProgress = false;
    }
}

function renderDashboard(data, fromCache) {
    window.currentDashboardData = data;
    updateDataUploadReminder(data && data.timestamp, fromCache);
    if (data.timestamp) {
        const timestampText = String(data.timestamp).trim();
        const timeMatch = timestampText.match(/(?:T|\s)(\d{2}:\d{2}(?::\d{2})?)/);
        const sourceTime = timeMatch ? timeMatch[1] : timestampText;
        if (fromCache) {
            lastSuccessfulUpdateText = sourceTime;
            document.getElementById('last-update').innerText = `快取資料｜來源更新：${sourceTime}`;
        } else {
            lastSuccessfulUpdateText = sourceTime;
            document.getElementById('last-update').innerText = sourceTime;
        }
    } else if (fromCache) {
        document.getElementById('last-update').innerText = "顯示上次快取資料｜更新時間未知";
    }

    // 產生 HTML 內容
    let htmlContent = '';
    
    // 遍歷設定檔中的每個群組 (DASHBOARD_CONFIG 來自 config.js)
    DASHBOARD_CONFIG.forEach(group => {
        const d02Status = group.id === "d02" ? String(data.D02_CWMS_STATUS || "").toLowerCase() : "";
        const d02StatusMessage = d02Status && d02Status !== "ok"
            ? (d02Status === "quota_exceeded"
                ? "環境部 CWMS 今日 API 呼叫額度已用盡，資料暫停更新，稍後自動重試。"
                : "環境部 CWMS 資料暫時無法取得，系統稍後自動重試。")
            : "";
        htmlContent += `
        <div class="system-group ${group.className}">
            <div class="system-title">${group.title} <span>${group.items.length}</span></div>
            ${d02StatusMessage ? `<div class="cwms-status" role="status">${d02StatusMessage}</div>` : ""}
            <div class="inner-grid">`;

        // 遍歷群組內的每個卡片
        group.items.forEach(item => {
            if (group.id === "acc") {
                const todayRaw = data[item.col + "_DAILY"];
                const yesterdayRaw = data[item.col + "_YESTERDAY"];
                const today = todayRaw !== undefined && todayRaw !== null && todayRaw !== "" ? todayRaw : "--";
                const yesterday = yesterdayRaw !== undefined && yesterdayRaw !== null && yesterdayRaw !== "" ? yesterdayRaw : "--";
                const displayVal = `${today} / <span style="font-size:0.8em; color:var(--text-sub);">${yesterday}</span>`;
                const statusClass = checkAlarm(item.col + "_DAILY", today);
                const gaugeHTML = getGaugeHTML(item.col + "_DAILY", today);
                htmlContent += generateCardHTML(statusClass, item.name, item.tag, displayVal, item.unit, gaugeHTML, item.col + "_DAILY");
            } else {
                const rawVal = data[item.col] !== undefined && data[item.col] !== null ? data[item.col] : '--';
                let displayVal = rawVal;
                const numericVal = Number(rawVal);
                if (rawVal !== '--' && Number.isFinite(numericVal) && String(rawVal).includes('.')) {
                    displayVal = numericVal.toFixed(1);
                    if(displayVal.endsWith('.0')) displayVal = displayVal.replace('.0', '');
                }
                const statusClass = checkAlarm(item.col, rawVal);
                const gaugeHTML = getGaugeHTML(item.col, rawVal);
                htmlContent += generateCardHTML(statusClass, item.name, item.tag, displayVal, item.unit, gaugeHTML, item.col);
            }
        });
        htmlContent += `</div></div>`;
    });

    document.getElementById('app').innerHTML = htmlContent;
}

/**
 * 產生單張卡片的 HTML 結構
 */
function generateCardHTML(statusClass, name, tag, valueDisplay, unit, gaugeHTML, colName) {
    return `
    <div class="card ${statusClass} card-configurable" data-settings-col="${escapeHtml(colName)}" data-settings-name="${escapeHtml(name)}" data-settings-unit="${escapeHtml(unit)}" role="button" tabindex="0" title="點擊修改監測設定" onclick="openCardSettings(this)" onkeydown="handleCardSettingsKeydown(event, this)">
        <div class="card-header">
            <span class="tag-name">${name}</span>
            <span class="tag-id">${tag}</span>
        </div>
        <div class="data-row">
            <span class="value">${valueDisplay}</span>
            <span class="unit">${unit}</span>
        </div>
        ${gaugeHTML}
    </div>`;
}

/**
 * 檢查警報狀態，回傳對應的 CSS class
 * (status-critical, status-warning, status-running, 或空字串)
 */
function checkAlarm(colName, value) {
    let val = parseFloat(value);
    if (isNaN(val)) return "";

    // pH 值沿用既有雙向警報；有自訂設定時改走一般門檻判斷。
    if (colName.indexOf("PHI") !== -1 && !hasCustomAlarmRule(colName)) {
        if (val < 6 || val > 9) return "status-critical";
        if (val < 6.5 || val > 8.5) return "status-warning";
        return "";
    }

    // 一般數值判斷：優先使用使用者自訂門檻，否則沿用預設值。
    const rule = getAlarmRule(colName);
    const hasThresholds = rule &&
        getNumberOrNull(rule.warn) !== null &&
        getNumberOrNull(rule.crit) !== null;
    if (hasThresholds) {
        const warn = Number(rule.warn);
        const crit = Number(rule.crit);
        const isLowAlarm = warn > crit;

        if (isLowAlarm) {
            if (val <= crit) return "status-critical";
            if (val <= warn) return "status-warning";
        } else {
            if (val >= crit) return "status-critical";
            if (val >= warn) return "status-warning";
        }
    }

    // 運轉狀態判斷 (如果是流量計且有數值，顯示綠色運轉燈)
    // 這裡需要遍歷設定檔來確認單位是否為 M3/Hr
    const isFlow = DASHBOARD_CONFIG.some(g => g.items.some(i => i.col === colName && i.unit === "M3/Hr"));
    if (isFlow) {
        if (val > 0) {
            // 如果沒有設警報，或者數值未達警告值，則顯示運轉中
            if (!rule || getNumberOrNull(rule.warn) === null || val < Number(rule.warn)) return "status-running";
        }
    }

    return "";
}

/**
 * 產生儀表條 (Gauge Bar) 的 HTML
 */
function getGaugeHTML(colName, value) {
    let val = parseFloat(value);
    if (isNaN(val)) return "";

    // pH 未自訂時保留原本 0–14 與雙向警戒顏色。
    if (colName.indexOf("PHI") !== -1 && !hasCustomAlarmRule(colName)) {
        let pct = Math.max(0, Math.min((val / 14) * 100, 100));
        let colorVar = "var(--gauge-good)";
        if (val < 6 || val > 9) colorVar = "var(--gauge-bad)";
        else if (val < 6.5 || val > 8.5) colorVar = "var(--gauge-warn)";

        return `<div class="gauge-container">
                    <div style="width: ${pct}%; background-color: ${colorVar}; height:100%; border-radius:3px;"></div>
                    <div class="gauge-marker" style="left: ${pct}%"></div>
                </div>`;
    }

    const rule = getAlarmRule(colName);
    if (!rule || getNumberOrNull(rule.max) === null) return "";

    const min = getNumberOrNull(rule.min) ?? 0;
    const max = Number(rule.max);
    const range = max - min;
    if (range <= 0) return "";

    const toPct = number => Math.max(0, Math.min(((number - min) / range) * 100, 100));
    const valPct = toPct(val);
    const warn = getNumberOrNull(rule.warn);
    const crit = getNumberOrNull(rule.crit);

    if (warn === null || crit === null || warn === crit) {
        return `<div class="gauge-container">
                    <div class="gauge-seg seg-good" style="width:100%"></div>
                    <div class="gauge-marker" style="left: ${valPct}%"></div>
                </div>`;
    }

    const isLowAlarm = warn > crit;
    const critPct = toPct(crit);
    const warnPct = toPct(warn);

    if (isLowAlarm) {
        return `<div class="gauge-container">
            <div class="gauge-seg seg-rev-poor" style="width: ${critPct}%"></div>
            <div class="gauge-seg seg-rev-warn" style="width: ${Math.max(0, warnPct - critPct)}%"></div>
            <div class="gauge-seg seg-rev-good" style="width: ${Math.max(0, 100 - warnPct)}%"></div>
            <div class="gauge-marker" style="left: ${valPct}%"></div>
        </div>`;
    }

    return `<div class="gauge-container">
        <div class="gauge-seg seg-good" style="width: ${warnPct}%"></div>
        <div class="gauge-seg seg-warn" style="width: ${Math.max(0, critPct - warnPct)}%"></div>
        <div class="gauge-seg seg-poor" style="width: ${Math.max(0, 100 - critPct)}%"></div>
        <div class="gauge-marker" style="left: ${valPct}%"></div>
    </div>`;
}

/**
 * 切換明亮/深色模式
 */
function toggleTheme() {
    const body = document.body;
    const newTheme = body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    body.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    document.getElementById("themeBtn").innerText = newTheme === "dark" ? "☀️" : "🌓";
    
    // 如果圖表已經初始化，通知圖表更新顏色 (如果 charts.js 已載入)
    if (typeof updateChart === "function" && typeof myChart !== 'undefined' && myChart) {
         // 這裡需要 charts.js 裡的 updateChart 支援重繪，或者簡單觸發
         const isDark = newTheme === "dark";
         const gridColor = isDark ? '#444' : '#ddd';
         const textColor = isDark ? '#eee' : '#666';
         
         myChart.options.scales.x.grid.color = gridColor;
         myChart.options.scales.y.grid.color = gridColor;
         myChart.options.scales.x.ticks.color = textColor;
         myChart.options.scales.y.ticks.color = textColor;
         myChart.options.plugins.legend.labels.color = textColor;
         myChart.update();
    }
}
