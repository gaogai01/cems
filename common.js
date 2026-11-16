// ============================================================
// 1. Firebase 設定 (請填入您的設定)
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyA58DOYplXhmo7HDYN_2Hgu-wo4ceYmINA",
  authDomain: "tpc-monitor.firebaseapp.com",
  projectId: "tpc-monitor",
  storageBucket: "tpc-monitor.firebasestorage.app",
  messagingSenderId: "1066125366380",
  appId: "1:1066125366380:web:836d5898c051226669f449"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const auth = firebase.auth();
const db = firebase.firestore();

// ============================================================
// 2. 定義權限與選單
// ============================================================
const ROLE_ACCESS = {
    'admin': ['index.html', 'cems.html', 'urea.html', 'oil.html', 'daily.html', 'monthly.html', 'try.html', 'admin.html', 'meet.html', 'plan.html', 'bigtime.html', 'newyear.html', 'mv.html'],
    'env':   ['index.html', 'cems.html', 'urea.html', 'oil.html', 'daily.html', 'monthly.html', 'meet.html', 'plan.html', 'bigtime.html', 'newyear.html', 'mv.html'],
    'mech':  ['oil.html', 'meet.html', 'plan.html', 'bigtime.html', 'newyear.html', 'mv.html'],
    'ops':   ['cems.html', 'oil.html', 'meet.html', 'plan.html', 'bigtime.html', 'newyear.html', 'mv.html'],
    'guest': ['meet.html', 'plan.html', 'bigtime.html', 'newyear.html', 'mv.html']
};

const ALL_PAGES = {
    'index.html': '廢水處理',
    'cems.html':  'CEMS監測',
    'urea.html':  '尿素分析',
    'oil.html':   '滑油報告',
    'daily.html': '每日紀錄',
    'monthly.html': '每月紀錄',
    'try.html': '測試',
    'admin.html': '後台管理',
    'meet.html': '廠務會議報告',
    'plan.html': '採購發包進度',
    'bigtime.html': '機組運轉時數',
    'newyear.html': '公益活動節目表',
    'mv.html': '影片拍攝企劃'
};
const OTHER_PAGES = ['meet.html', 'plan.html', 'bigtime.html', 'newyear.html', 'mv.html'];

const PAGE_SHEETS = {
    'index.html':   { title: '廢水處理室資料庫', url: 'https://docs.google.com/spreadsheets/d/1Zbpcze9d3FD1fhIFXSAx44Qc9wQXLzpJxRiBwO5vVz0/edit?usp=sharing' },
    'cems.html':    { title: 'CEMS數據', url: 'https://docs.google.com/spreadsheets/d/1TX_B1yOiqN-f2ofCAiOHp2uc1sqXhZU50j_LtHprGzM/edit?usp=sharing' },
    'urea.html':    { title: '每日巡查紀錄表', url: 'https://docs.google.com/spreadsheets/d/1AKWbhgRP7UxDJ2a3ynEqTefjuT1ARd-VDmKSr5gsevk/edit?usp=sharing' },
    'oil.html':     { title: '綜研所滑油化驗報告', url: 'https://docs.google.com/spreadsheets/d/13FMsoQ8zwlC8IYOXxK9uGMSFuLmh0pL7ERHEUgvLz5s/edit?usp=sharing' },
    'daily.html':   { title: '每日巡查紀錄表', url: 'https://docs.google.com/spreadsheets/d/1AKWbhgRP7UxDJ2a3ynEqTefjuT1ARd-VDmKSr5gsevk/edit?usp=sharing' },
    'monthly.html': { title: '每月環化紀錄表', url: 'https://docs.google.com/spreadsheets/d/1rTTUmA6R1ZVH7tjNFZM-L6Cykiv8L2kVRPhDLXktv1o/edit?usp=sharing' },
    'meet.html':    { title: '每月環化紀錄表', url: 'https://docs.google.com/spreadsheets/d/1rTTUmA6R1ZVH7tjNFZM-L6Cykiv8L2kVRPhDLXktv1o/edit?usp=sharing' },
    'plan.html':    { title: '115年尖山發電廠發包進度表', url: 'https://docs.google.com/spreadsheets/d/1M7A5w3DkfD2SOji5slo0iN2ChQFcgprQiInhjSIzf0Q/edit?usp=sharing' },
    'bigtime.html': { title: '尖山發電廠機組運轉時數', url: 'https://docs.google.com/spreadsheets/d/1-6NiRVNfLzVaqr6775STcrjdy9gyKiHHU1jNewiyUiY/edit?usp=sharing' }
};

// ============================================================
// 3. 權限檢查 & 心跳機制
// ============================================================
auth.onAuthStateChanged(async (user) => {
    if (window.location.pathname.includes("login.html")) return;

    if (!user) {
        location.href = 'login.html';
        return;
    }

    try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (!doc.exists || !doc.data().isApproved) {
            alert("您的帳號尚未核准或已被停用。");
            location.href = 'login.html';
            return;
        }

        const userData = doc.data();
        const userRole = userData.role || 'guest';
        const allowedPages = ROLE_ACCESS[userRole] || [];
        
        // 1. 檢查當前頁面是否有權限
        const path = window.location.pathname;
        const currentPage = path.substring(path.lastIndexOf('/') + 1) || "index.html";

        if (!allowedPages.includes(currentPage)) {
            if (allowedPages.length > 0) {
                alert(`您 (${userData.dept}-${userData.title}) 沒有權限訪問此頁面。`);
                location.href = allowedPages[0];
            } else {
                alert("您目前沒有任何頁面的訪問權限。");
                location.href = 'login.html';
            }
            return;
        }

        // 2. 權限通過，渲染導航列
        renderNavbar(userData.name, userRole, allowedPages);
        
        // 3. 啟動心跳 (回報線上狀態)
        updateHeartbeat(user.uid);
        setInterval(() => updateHeartbeat(user.uid), 180000); // 每 3 分鐘回報一次

        // 4. 啟動頁面邏輯
        if (typeof startApp === "function") {
            startApp();
        }

    } catch (e) {
        console.error("Auth Error:", e);
    }
});

// 更新最後上線時間
function updateHeartbeat(uid) {
    db.collection('users').doc(uid).update({
        lastSeen: new Date()
    }).catch(err => console.log("Heartbeat fail", err));
}

function renderNavbar(userName, role, allowedPages) {
    const navPlaceholder = document.getElementById("navbar-placeholder");
    if (!navPlaceholder) return;

    const currentPage = window.location.pathname.split('/').pop() || "index.html";
    let menuHtml = "";
    const otherLinks = [];

    allowedPages.forEach(page => {
        if (page === 'admin.html') return;
        const name = ALL_PAGES[page];
        if (!name) return;

        const isActive = currentPage === page ? "active" : "";
        const linkHtml = `<a href="${page}" class="nav-link ${isActive}" ${isActive ? 'aria-current="page"' : ''}>${name}</a>`;
        if (OTHER_PAGES.includes(page)) otherLinks.push(linkHtml);
        else menuHtml += linkHtml;
    });

    const otherIsActive = OTHER_PAGES.includes(currentPage);
    const otherMenuHtml = otherLinks.length
        ? `<details class="nav-dropdown" ${otherIsActive ? 'open' : ''}>
                <summary class="nav-link ${otherIsActive ? 'active' : ''}">其他 <span aria-hidden="true">▾</span></summary>
                <div class="nav-dropdown-menu">${otherLinks.join("")}</div>
           </details>`
        : "";

    let adminBtnHtml = "";
    if (role === 'admin') {
        const isActive = currentPage === 'admin.html' ? "active" : "";
        adminBtnHtml = `<a href="admin.html" class="nav-link admin-nav-link ${isActive}" ${isActive ? 'aria-current="page"' : ''}>⚙️ 後台管理</a>`;
    }

    navPlaceholder.innerHTML = `
        <style>
            .navbar { background: #333; padding: 10px 15px; display: flex; align-items: center; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; box-shadow: 0 2px 5px rgba(0,0,0,0.2); position: relative; z-index: 1001; }
            .navbar .nav-link { color: #ccc; text-decoration: none; font-size: 0.95rem; padding: 6px 12px; border: 0; border-radius: 5px; transition: 0.2s; white-space: nowrap; font-family: "Microsoft JhengHei", sans-serif; background: transparent; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
            .navbar .nav-link:hover, .nav-dropdown[open] > summary { background: #555; color: white; }
            .navbar .nav-link.active { background: #007bff; color: white; font-weight: bold; }
            .nav-dropdown { position: relative; }
            .nav-dropdown > summary { list-style: none; }
            .nav-dropdown > summary::-webkit-details-marker { display: none; }
            .nav-dropdown-menu { display: none; position: absolute; top: calc(100% + 4px); left: 0; min-width: 220px; padding: 6px; background: #333; border: 1px solid #555; border-radius: 6px; box-shadow: 0 8px 18px rgba(0,0,0,.25); flex-direction: column; gap: 2px; z-index: 1002; }
            .nav-dropdown[open] .nav-dropdown-menu { display: flex; }
            .nav-dropdown-menu .nav-link { width: 100%; box-sizing: border-box; }
            .sheet-edit-link { background: #198754 !important; color: #fff !important; font-weight: 600; }
            .sheet-edit-link:hover { background: #157347 !important; }
            .user-info { margin-left: auto; color: white; font-size: 0.85rem; display: flex; align-items: center; gap: 10px; font-family: "Microsoft JhengHei", sans-serif; }
            .btn-logout { background: transparent; border: 1px solid #666; color: #aaa; cursor: pointer; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; transition:0.3s; }
            .btn-logout:hover { border-color: #f8d7da; color: #f8d7da; }
            @media (max-width: 768px) {
                .navbar { padding: 8px; gap: 5px; }
                .navbar > .nav-link, .nav-dropdown > summary { font-size: 0.85rem; padding: 5px 8px; flex: 1; justify-content: center; text-align: center; }
                .nav-dropdown { flex: 1; }
                .nav-dropdown-menu { min-width: min(240px, 90vw); }
                .user-info { width: 100%; justify-content: flex-end; margin-top: 5px; border-top: 1px solid #444; padding-top: 5px; }
            }
            @media print { #navbar-placeholder { display: none !important; } }
        </style>
        <div class="navbar">
            ${menuHtml}
            ${otherMenuHtml}
            ${adminBtnHtml}
            ${PAGE_SHEETS[currentPage] ? `<a class="nav-link sheet-edit-link" href="${PAGE_SHEETS[currentPage].url}" target="_blank" rel="noopener noreferrer" title="開啟來源試算表：${PAGE_SHEETS[currentPage].title}">📊 編輯來源試算表</a>` : ""}
            <div class="user-info">
                <span>👤 ${typeof escapeHtml === "function" ? escapeHtml(userName) : String(userName || "")}</span>
                <button class="btn-logout" onclick="logout()">登出</button>
            </div>
        </div>
    `;
}
function logout() {
    auth.signOut().then(() => location.href = 'login.html');
}
