// ============================================================
// 1. Firebase 設定 (請務必填入)
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
// 2. 定義權限與選單 (RBAC 核心)
// ============================================================
// 每個角色能看到的頁面清單
const ROLE_ACCESS = {
    'admin': ['index.html', 'cems.html', 'urea.html', 'oil.html'], // 管理員：全開
    'env':   ['index.html', 'cems.html', 'urea.html', 'oil.html'], // 環化課：全開
    'mech':  ['oil.html'],                                         // 機械組：只看滑油
    'ops':   ['cems.html', 'oil.html'],                            // 運轉組：CEMS + 滑油
    'guest': []                                                    // 訪客：無
};

// 所有頁面的定義
const ALL_PAGES = {
    'index.html': '廢油水處理',
    'cems.html':  'CEMS 監測',
    'urea.html':  '尿素分析',
    'oil.html':   '滑油報告'
};

// ============================================================
// 3. 自動產生導航列 & 權限檢查
// ============================================================
auth.onAuthStateChanged(async (user) => {
    // 如果在登入頁，不執行導航列生成
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
        const currentPage = window.location.pathname.split("/").pop() || "index.html";
        if (!allowedPages.includes(currentPage)) {
            // 如果沒權限，跳轉到該角色能看的第一個頁面
            if (allowedPages.length > 0) {
                alert(`您 (${userData.dept}-${userData.title}) 沒有權限訪問此頁面。`);
                location.href = allowedPages[0];
            } else {
                alert("您目前沒有任何頁面的訪問權限。");
                location.href = 'login.html';
            }
            return;
        }

        // 2. 權限通過，顯示名字
        renderNavbar(userData.name, userRole, allowedPages);
        
        // 3. 啟動頁面邏輯
        if (typeof startApp === "function") {
            startApp();
        }

    } catch (e) {
        console.error("Auth Error:", e);
        // 避免無窮迴圈，出錯時停留在原地或跳登入
    }
});

function renderNavbar(userName, role, allowedPages) {
    const navPlaceholder = document.getElementById("navbar-placeholder");
    if (!navPlaceholder) return;

    // 根據權限生成選單 HTML
    let menuHtml = "";
    allowedPages.forEach(page => {
        const name = ALL_PAGES[page];
        const isActive = window.location.pathname.includes(page) ? "active" : "";
        menuHtml += `<a href="${page}" class="nav-link ${isActive}">${name}</a>`;
    });

    // 注入 HTML
    navPlaceholder.innerHTML = `
        <style>
            /* 響應式導航列樣式 */
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
            <div class="user-info">
                <span>👤 ${userName}</span>
                <button class="btn-logout" onclick="logout()">登出</button>
            </div>
        </div>
    `;
}

function logout() {
    auth.signOut().then(() => location.href = 'login.html');
}
