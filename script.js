import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    getFirestore,
    doc,
    runTransaction,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* إعدادات Firebase */
const firebaseConfig = {
    apiKey: "AIzaSyDeuWVOzOs784lretb6GVByMspAY4EzN_k",
    authDomain: "family-b2c75.firebaseapp.com",
    projectId: "family-b2c75",
    storageBucket: "family-b2c75.firebasestorage.app",
    messagingSenderId: "321218921724",
    appId: "1:321218921724:web:b7b0a62b62ff499b798379",
    measurementId: "G-RW48CJ6160"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const FAMILY_MEMBERS = [
    "الوالد التجاني",
    "الوالدة تهاني",
    "أحمد",
    "السر",
    "أسامة",
    "محمد"
];

const MEMBER_EMAILS = {
    "الوالد التجاني": "eltijani@family.com",
    "الوالدة تهاني": "tahani@family.com",
    "أحمد": "ahmed@family.com",
    "السر": "elssier@family.com",
    "أسامة": "osama@family.com",
    "محمد": "mohamed@family.com"
};

const STORAGE_KEYS = {
    tasks: "familyTasks",
    scores: "familyScores",
    theme: "familyTheme"
};

const EXP_PER_TASK = 10;
const EXP_PER_LEVEL = 100;
const SHARED_DOC = doc(db, "familyData", "shared");

let tasks = [];
let familyScores = {};
let currentFilter = "all";
let currentUser = "";
let unsubscribeSharedData = null;
let cloudReady = false;

function readStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
        console.warn("تعذر قراءة التخزين المحلي:", error);
        return fallback;
    }
}

function createId() {
    return globalThis.crypto?.randomUUID?.()
        || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function normalizeTasks(value) {
    if (!Array.isArray(value)) return [];

    return value.map(task => ({
        id: String(task.id || createId()),
        text: String(task.text || "").trim(),
        category: String(task.category || "📌 أخرى"),
        user: [...FAMILY_MEMBERS, "العائلة"].includes(task.user) ? task.user : "العائلة",
        completed: Boolean(task.completed),
        awardedTo: FAMILY_MEMBERS.includes(task.awardedTo) ? task.awardedTo : ""
    })).filter(task => task.text);
}

function normalizeScores(value) {
    const result = {};

    FAMILY_MEMBERS.forEach(member => {
        const score = Number(value?.[member] ?? 0);
        result[member] = Number.isFinite(score) ? Math.max(0, score) : 0;
    });

    return result;
}

function mirrorLocalData() {
    try {
        localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
        localStorage.setItem(STORAGE_KEYS.scores, JSON.stringify(familyScores));
    } catch (error) {
        console.warn("تعذر تحديث النسخة المحلية:", error);
    }
}

function getLevel(exp) {
    const safeExp = Math.max(0, Number(exp) || 0);
    const intoLevel = safeExp % EXP_PER_LEVEL;

    return {
        level: Math.floor(safeExp / EXP_PER_LEVEL) + 1,
        intoLevel,
        remaining: EXP_PER_LEVEL - intoLevel,
        percent: intoLevel
    };
}

function setLoginError(message) {
    const error = document.getElementById("loginError");
    if (error) error.textContent = message || "";
}

function setLoginBusy(busy) {
    const button = document.getElementById("loginButton");
    if (!button) return;

    button.disabled = busy;

    const label = button.querySelector("span");
    if (label) label.textContent = busy ? "جارٍ التحقق..." : "دخول المنصة";
}

document.addEventListener("DOMContentLoaded", () => {
    initializeTheme();
    initializeEvents();
});

function initializeEvents() {
    document.getElementById("loginForm")?.addEventListener("submit", handleLogin);
    document.getElementById("logoutButton")?.addEventListener("click", logout);

    document.getElementById("taskForm")?.addEventListener("submit", event => {
        event.preventDefault();
        addTask();
    });

    document.getElementById("themeToggle")?.addEventListener("click", toggleDarkMode);

    document.querySelectorAll(".filter-btn").forEach(button => {
        button.addEventListener("click", () => {
            currentFilter = button.dataset.filter || "all";

            document.querySelectorAll(".filter-btn").forEach(btn => {
                btn.classList.toggle("active", btn === button);
            });

            renderTasks();
        });
    });

    const taskList = document.getElementById("taskList");

    taskList?.addEventListener("change", event => {
        if (event.target.classList.contains("task-check")) {
            toggleTask(event.target.dataset.id);
        }
    });

    taskList?.addEventListener("click", event => {
        const button = event.target.closest(".delete-btn");
        if (button) deleteTask(button.dataset.id);
    });

    onAuthStateChanged(auth, async user => {
        if (!user) {
            stopSharedListener();
            currentUser = "";
            cloudReady = false;
            showLogin();
            return;
        }

        const email = (user.email || "").toLowerCase();

        const member = Object.keys(MEMBER_EMAILS).find(
            name => MEMBER_EMAILS[name].toLowerCase() === email
        );

        if (!member) {
            await signOut(auth);
            setLoginError("هذا الحساب غير موجود ضمن حسابات العائلة المعتمدة.");
            return;
        }

        currentUser = member;
        document.getElementById("loginMember").value = member;

        await startSharedData();
    });
}

async function handleLogin(event) {
    event.preventDefault();

    const member = document.getElementById("loginMember").value;
    const password = document.getElementById("loginPassword").value;
    const email = MEMBER_EMAILS[member];

    setLoginError("");

    if (!email || !password) {
        setLoginError("اختر اسمك وأدخل كلمة المرور.");
        return;
    }

    setLoginBusy(true);

    try {
        await signInWithEmailAndPassword(auth, email, password);
        document.getElementById("loginPassword").value = "";
    } catch (error) {
        console.error("Firebase login error:", error);

        const messages = {
            "auth/invalid-credential": "كلمة المرور غير صحيحة أو بيانات الحساب غير صحيحة.",
            "auth/wrong-password": "كلمة المرور غير صحيحة.",
            "auth/user-not-found": "هذا الحساب غير موجود في Firebase Authentication.",
            "auth/invalid-email": "البريد الإلكتروني المرتبط بهذا الاسم غير صالح.",
            "auth/too-many-requests": "محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.",
            "auth/network-request-failed": "تعذر الاتصال بالإنترنت. تحقق من الاتصال وحاول مرة أخرى.",
            "auth/user-disabled": "هذا الحساب معطل. راجع إعدادات Firebase."
        };

        setLoginError(messages[error.code] || `تعذر تسجيل الدخول: ${error.message}`);
    } finally {
        setLoginBusy(false);
    }
}

async function logout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error(error);
        alert("تعذر تسجيل الخروج. حاول مرة أخرى.");
    }
}

function showLogin() {
    document.getElementById("loginScreen").hidden = false;
    document.getElementById("appContainer").hidden = true;

    const password = document.getElementById("loginPassword");
    if (password) password.value = "";
}

function showApp() {
    document.getElementById("loginScreen").hidden = true;
    document.getElementById("appContainer").hidden = false;

    const selector = document.getElementById("userSelect");
    if (selector && currentUser) selector.value = currentUser;

    renderTasks();
    updateDashboard();
    updateLeaderboard();
    updatePersonalProfile();
}

function stopSharedListener() {
    if (typeof unsubscribeSharedData === "function") {
        unsubscribeSharedData();
        unsubscribeSharedData = null;
    }
}

async function startSharedData() {
    try {
        await migrateLocalDataIfNeeded();

        stopSharedListener();

        unsubscribeSharedData = onSnapshot(SHARED_DOC, snapshot => {
            const data = snapshot.exists() ? snapshot.data() : {};

            tasks = normalizeTasks(data.tasks);
            familyScores = normalizeScores(data.scores);
            cloudReady = true;

            mirrorLocalData();
            showAppAndRefresh();
        }, error => {
            console.error("Firestore listener error:", error);
            cloudReady = false;
            alert("تم تسجيل الدخول، لكن تعذر تحميل بيانات العائلة. تحقق من قواعد Firestore.");
        });
    } catch (error) {
        console.error("Firestore setup error:", error);
        alert("تم تسجيل الدخول لكن تعذر تهيئة بيانات العائلة. تأكد من إنشاء قاعدة Firestore وضبط قواعدها.");
    }
}

/* نقل البيانات القديمة من المتصفح مرة واحدة فقط إذا لم توجد بيانات سحابية */
async function migrateLocalDataIfNeeded() {
    await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(SHARED_DOC);

        if (snapshot.exists()) return;

        const oldTasks = normalizeTasks(readStorage(STORAGE_KEYS.tasks, []));
        const oldScores = normalizeScores(readStorage(STORAGE_KEYS.scores, {}));

        transaction.set(SHARED_DOC, {
            tasks: oldTasks,
            scores: oldScores,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    });
}

async function updateSharedData(mutator) {
    if (!auth.currentUser || !cloudReady) {
        alert("بيانات العائلة لم تكتمل مزامنتها بعد. انتظر لحظة ثم حاول.");
        return false;
    }

    try {
        await runTransaction(db, async transaction => {
            const snapshot = await transaction.get(SHARED_DOC);
            const data = snapshot.exists() ? snapshot.data() : {};

            const nextTasks = normalizeTasks(data.tasks);
            const nextScores = normalizeScores(data.scores);

            mutator(nextTasks, nextScores);

            transaction.set(SHARED_DOC, {
                tasks: nextTasks,
                scores: nextScores,
                updatedAt: serverTimestamp()
            }, { merge: true });
        });

        return true;
    } catch (error) {
        console.error("Firestore update error:", error);
        alert("لم يتم حفظ التغيير في السحابة. تحقق من الاتصال وقواعد Firestore.");
        return false;
    }
}

async function addTask() {
    const input = document.getElementById("taskInput");
    const category = document.getElementById("categorySelect").value;
    const user = document.getElementById("userSelect").value;
    const text = input.value.trim();

    if (!text) {
        alert("اكتب اسم المهمة أولاً!");
        input.focus();
        return;
    }

    const added = await updateSharedData(cloudTasks => {
        cloudTasks.unshift({
            id: createId(),
            text,
            category,
            user,
            completed: false,
            awardedTo: ""
        });
    });

    if (added) {
        input.value = "";
        input.focus();
    }
}

async function toggleTask(id) {
    await updateSharedData((cloudTasks, scores) => {
        const task = cloudTasks.find(item => item.id === id);
        if (!task) return;

        if (!task.completed) {
            const recipient = task.user === "العائلة" ? currentUser : task.user;

            task.completed = true;
            task.awardedTo = FAMILY_MEMBERS.includes(recipient) ? recipient : currentUser;

            scores[task.awardedTo] = (scores[task.awardedTo] || 0) + EXP_PER_TASK;
        } else {
            task.completed = false;

            if (task.awardedTo && FAMILY_MEMBERS.includes(task.awardedTo)) {
                scores[task.awardedTo] = Math.max(
                    0,
                    (scores[task.awardedTo] || 0) - EXP_PER_TASK
                );
            }

            task.awardedTo = "";
        }
    });
}

async function deleteTask(id) {
    const confirmed = confirm("هل تريد حذف هذه المهمة؟");
    if (!confirmed) return;

    await updateSharedData((cloudTasks, scores) => {
        const index = cloudTasks.findIndex(item => item.id === id);
        if (index === -1) return;

        const [task] = cloudTasks.splice(index, 1);

        if (task.completed && task.awardedTo && FAMILY_MEMBERS.includes(task.awardedTo)) {
            scores[task.awardedTo] = Math.max(
                0,
                (scores[task.awardedTo] || 0) - EXP_PER_TASK
            );
        }
    });
}

function renderTasks() {
    const list = document.getElementById("taskList");
    const emptyState = document.getElementById("emptyState");

    if (!list) return;

    list.replaceChildren();

    const filtered = tasks.filter(task => {
        if (currentFilter === "pending") return !task.completed;
        if (currentFilter === "completed") return task.completed;
        return true;
    });

    if (emptyState) emptyState.hidden = filtered.length > 0;
    list.hidden = filtered.length === 0;

    filtered.forEach(task => {
        const item = document.createElement("li");
        item.className = "task-item" + (task.completed ? " completed" : "");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-check";
        checkbox.checked = task.completed;
        checkbox.dataset.id = task.id;
        checkbox.setAttribute("aria-label", "تغيير حالة المهمة");

        const info = document.createElement("div");
        info.className = "task-info";

        const name = document.createElement("span");
        name.className = "task-name";
        name.textContent = task.text;

        const meta = document.createElement("div");
        meta.className = "task-meta";

        const category = document.createElement("span");
        category.className = "task-tag";
        category.textContent = task.category;

        const user = document.createElement("span");
        user.className = "task-tag";
        user.textContent = "👤 " + task.user;

        meta.append(category, user);
        info.append(name, meta);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-btn";
        deleteButton.textContent = "حذف";
        deleteButton.dataset.id = task.id;
        deleteButton.setAttribute("aria-label", "حذف المهمة");

        item.append(checkbox, info, deleteButton);
        list.append(item);
    });

    const count = document.getElementById("taskCount");
    if (count) count.textContent = `${filtered.length} مهمة`;
}

function updateDashboard() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const remaining = total - completed;

    const totalExp = Object.values(familyScores).reduce(
        (sum, value) => sum + Number(value || 0),
        0
    );

    const percent = total ? Math.round((completed / total) * 100) : 0;

    document.getElementById("totalTasks").textContent = total;
    document.getElementById("completedTasks").textContent = completed;
    document.getElementById("remainingTasks").textContent = remaining;
    document.getElementById("totalPoints").textContent = totalExp;
    document.getElementById("progressText").textContent = `${percent}%`;
    document.getElementById("progressBar").style.width = `${percent}%`;

    const message = percent === 100 && total
        ? "رائع! أنجزتم جميع المهام 🎉"
        : completed
            ? "أحسنتم! واصلوا التقدم معاً."
            : "لنبدأ بإنجاز مهامنا اليوم!";

    document.getElementById("progressMessage").textContent = message;
}

function updatePersonalProfile() {
    if (!currentUser) return;

    const exp = familyScores[currentUser] || 0;
    const level = getLevel(exp);

    document.getElementById("personalName").textContent = currentUser;
    document.getElementById("personalLevel").textContent = `المستوى ${level.level}`;
    document.getElementById("personalExp").textContent = `${exp} EXP`;
    document.getElementById("personalLevelBar").style.width = `${level.percent}%`;
    document.getElementById("personalLevelCaption").textContent =
        `${level.intoLevel} / ${EXP_PER_LEVEL} EXP للمستوى التالي`;
}

function updateLeaderboard() {
    const leaderboard = document.getElementById("leaderboard");
    if (!leaderboard) return;

    leaderboard.replaceChildren();

    const sorted = FAMILY_MEMBERS
        .map(member => ({ name: member, exp: familyScores[member] || 0 }))
        .sort((a, b) => b.exp - a.exp);

    sorted.forEach((person, index) => {
        const row = document.createElement("div");
        row.className = "leader-row";

        const rank = document.createElement("span");
        rank.className = "leader-rank";
        rank.textContent = ["🥇", "🥈", "🥉"][index] || String(index + 1);

        const name = document.createElement("span");
        name.className = "leader-name";
        name.textContent = person.name;

        const level = document.createElement("small");
        level.className = "leader-level";
        level.textContent = `المستوى ${getLevel(person.exp).level}`;
        name.append(level);

        const points = document.createElement("span");
        points.className = "leader-points";
        points.textContent = `${person.exp} EXP`;

        row.append(rank, name, points);
        leaderboard.append(row);
    });
}

function refreshDashboard() {
    renderTasks();
    updateDashboard();
    updateLeaderboard();
    updatePersonalProfile();
}

/* الوضع الليلي */
function initializeTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);

    if (savedTheme === "dark") {
        document.body.classList.add("dark-theme");
    }

    updateThemeButton();
}

function toggleDarkMode() {
    document.body.classList.toggle("dark-theme");

    localStorage.setItem(
        STORAGE_KEYS.theme,
        document.body.classList.contains("dark-theme") ? "dark" : "light"
    );

    updateThemeButton();
}

function updateThemeButton() {
    const dark = document.body.classList.contains("dark-theme");
    const icon = document.getElementById("themeIcon");
    const label = document.getElementById("themeLabel");

    if (icon) icon.textContent = dark ? "☀️" : "🌙";
    if (label) label.textContent = dark ? "الوضع النهاري" : "الوضع الليلي";
}

function showAppAndRefresh() {
    showApp();
    refreshDashboard();
}