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

function getLocalYearMonth(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

// ============================================================
// 2. 定義權限與選單
// ============================================================
const ROLE_ACCESS = {
    'admin': ['index.html', 'cems.html', 'urea.html', 'oil.html', 'daily.html','monthly.html','try.html','admin.html'], //管理者
    'env':   ['index.html', 'cems.html', 'urea.html', 'oil.html', 'daily.html','monthly.html'], //環化課
    'mech':  ['oil.html'], //機械組：僅滑油
    'ops':   ['cems.html', 'oil.html'], //運轉組：CEMS與滑油
    'guest': []
};

const ALL_PAGES = {
    'index.html': '廢水處理',
    'cems.html':  'CEMS監測',
    'urea.html':  '尿素分析',
    'oil.html':   '滑油報告',
    'daily.html': '每日紀錄',
    'monthly.html': '每月紀錄',
    'try.html': '測試',
    'admin.html': '後台管理' 
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

    let menuHtml = "";
    allowedPages.forEach(page => {
        if (page === 'admin.html') return; // 後台按鈕另外處理
        const name = ALL_PAGES[page];
        const isActive = window.location.pathname.includes(page) ? "active" : "";
        menuHtml += `<a href="${page}" class="nav-link ${isActive}">${name}</a>`;
    });

    // 如果是管理員，額外加入後台按鈕
    let adminBtnHtml = "";
    if (role === 'admin') {
        const isActive = window.location.pathname.includes('admin.html') ? "active" : "";
        // 使用紅色按鈕區隔
        adminBtnHtml = `<a href="admin.html" class="nav-link ${isActive}" style="background:#dc3545;color:white;">⚙️ 後台管理</a>`;
    }

    navPlaceholder.innerHTML = `
        <style>
            .navbar { background: #333; padding: 10px 15px; display: flex; align-items: center; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
            .nav-link { color: #ccc; text-decoration: none; font-size: 0.95rem; padding: 6px 12px; border-radius: 5px; transition: 0.2s; white-space: nowrap; font-family: "Microsoft JhengHei", sans-serif; }
            .nav-link:hover { background: #555; color: white; }
            .nav-link.active { background: #007bff; color: white; font-weight: bold; }
            .user-info { margin-left: auto; color: white; font-size: 0.85rem; display: flex; align-items: center; gap: 10px; font-family: "Microsoft JhengHei", sans-serif; }
            .btn-logout { background: transparent; border: 1px solid #666; color: #aaa; cursor: pointer; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; transition:0.3s; }
            .btn-logout:hover { border-color: #f8d7da; color: #f8d7da; }
            @media (max-width: 768px) {
                .navbar { padding: 8px; gap: 5px; }
                .nav-link { font-size: 0.85rem; padding: 5px 8px; flex: 1; text-align: center; }
                .user-info { width: 100%; justify-content: flex-end; margin-top: 5px; border-top: 1px solid #444; padding-top: 5px; }
            }
        </style>
        <div class="navbar">
            ${menuHtml}
            ${adminBtnHtml}
            <div class="user-info">
                <span>👤 ${escapeHtml(userName)}</span>
                <button class="btn-logout" onclick="logout()">登出</button>
            </div>
        </div>
    `;
}

function logout() {
    auth.signOut().then(() => location.href = 'login.html');
}
