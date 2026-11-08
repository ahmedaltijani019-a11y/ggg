
const FAMILY_MEMBERS = [
    "الوالد التجاني",
    "الوالدة تهاني",
    "أحمد",
    "السر",
    "أسامة",
    "محمد",
    "العائلة"
];

const STORAGE_KEYS = {
    tasks: "familyTasks",
    scores: "familyScores",
    theme: "familyTheme",
    pins: "familyPins",
    currentUser: "familyCurrentUser"
};

const EXP_PER_TASK = 10;
const EXP_PER_LEVEL = 100;

function readStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
        console.error("Storage read error:", error);
        return fallback;
    }
}

function saveStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error("Storage save error:", error);
        alert("تعذر حفظ البيانات في هذا المتصفح.");
        return false;
    }
}

function createId() {
    return (crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

let tasks = readStorage(STORAGE_KEYS.tasks, []);

if (!Array.isArray(tasks)) tasks = [];

tasks = tasks.map(task => ({
    id: task.id || createId(),
    text: String(task.text || ""),
    category: task.category || "📌 أخرى",
    user: FAMILY_MEMBERS.includes(task.user) ? task.user : "العائلة",
    completed: Boolean(task.completed)
})).filter(task => task.text);

saveStorage(STORAGE_KEYS.tasks, tasks);

let familyScores = readStorage(STORAGE_KEYS.scores, {});

if (!familyScores || typeof familyScores !== "object" || Array.isArray(familyScores)) {
    familyScores = {};
}

FAMILY_MEMBERS.forEach(member => {
    const value = Number(familyScores[member]);
    familyScores[member] = Number.isFinite(value) ? Math.max(0, value) : 0;
});

saveStorage(STORAGE_KEYS.scores, familyScores);

let currentFilter = "all";
let currentUser = localStorage.getItem(STORAGE_KEYS.currentUser) || "";

function getLevel(exp) {
    const safeExp = Math.max(0, Number(exp) || 0);

    return {
        level: Math.floor(safeExp / EXP_PER_LEVEL) + 1,
        intoLevel: safeExp % EXP_PER_LEVEL,
        remaining: EXP_PER_LEVEL - (safeExp % EXP_PER_LEVEL),
        percent: safeExp % EXP_PER_LEVEL
    };
}

document.addEventListener("DOMContentLoaded", () => {
    initializeTheme();
    initializeEvents();

    const rememberedUser = localStorage.getItem(STORAGE_KEYS.currentUser);

    if (rememberedUser && FAMILY_MEMBERS.includes(rememberedUser) && rememberedUser !== "العائلة") {
        currentUser = rememberedUser;
        showApp();
    } else {
        showLogin();
    }
});

function initializeEvents() {
    document.getElementById("loginButton")?.addEventListener("click", handleLogin);

    document.getElementById("loginPin")?.addEventListener("keydown", event => {
        if (event.key === "Enter") handleLogin();
    });

    document.getElementById("loginMember")?.addEventListener("change", updateLoginHint);
    document.getElementById("logoutButton")?.addEventListener("click", logout);

    document.getElementById("taskForm")?.addEventListener("submit", event => {
        event.preventDefault();
        addTask();
    });

    document.getElementById("themeToggle")?.addEventListener("click", toggleDarkMode);

    document.querySelectorAll(".filter-btn").forEach(button => {
        button.addEventListener("click", () => {
            currentFilter = button.dataset.filter;

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

    updateLoginHint();
}

function showLogin() {
    document.getElementById("loginScreen").hidden = false;
    document.getElementById("appContainer").hidden = true;
    document.getElementById("loginPin").value = "";
    document.getElementById("loginError").textContent = "";
    updateLoginHint();
}

function showApp() {
    document.getElementById("loginScreen").hidden = true;
    document.getElementById("appContainer").hidden = false;

    const selector = document.getElementById("userSelect");

    if (selector && currentUser !== "العائلة") {
        selector.value = currentUser;
    }

    renderTasks();
    updateDashboard();
    updateLeaderboard();
    updatePersonalProfile();
}

function updateLoginHint() {
    const member = document.getElementById("loginMember")?.value;
    const pins = readStorage(STORAGE_KEYS.pins, {});
    const hint = document.getElementById("loginHint");

    if (hint) {
        hint.textContent = pins[member]
            ? "أدخل رمز PIN الذي أنشأته لهذا الحساب."
            : "أول دخول لهذا الحساب: أدخل رمزاً جديداً من 4 إلى 8 أرقام لإنشائه.";
    }
}

function handleLogin() {
    const member = document.getElementById("loginMember").value;
    const pin = document.getElementById("loginPin").value.trim();
    const error = document.getElementById("loginError");
    const pins = readStorage(STORAGE_KEYS.pins, {});

    if (!/^\d{4,8}$/.test(pin)) {
        error.textContent = "رمز PIN يجب أن يتكون من 4 إلى 8 أرقام.";
        return;
    }

    if (pins[member] && pins[member] !== pin) {
        error.textContent = "رمز PIN غير صحيح. حاول مرة أخرى.";
        return;
    }

    if (!pins[member]) {
        pins[member] = pin;
        if (!saveStorage(STORAGE_KEYS.pins, pins)) return;
    }

    currentUser = member;
    localStorage.setItem(STORAGE_KEYS.currentUser, member);
    error.textContent = "";
    showApp();
}

function logout() {
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    currentUser = "";
    showLogin();
}

function addTask() {
    const input = document.getElementById("taskInput");
    const category = document.getElementById("categorySelect").value;
    const user = document.getElementById("userSelect").value;
    const text = input.value.trim();

    if (!text) {
        alert("اكتب اسم المهمة أولاً!");
        input.focus();
        return;
    }

    tasks.unshift({
        id: createId(),
        text,
        category,
        user,
        completed: false
    });

    saveStorage(STORAGE_KEYS.tasks, tasks);
    input.value = "";
    renderTasks();
    updateDashboard();
    input.focus();
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

        item.append(checkbox, info, deleteButton);
        list.appendChild(item);
    });

    const count = document.getElementById("taskCount");

    if (count) count.textContent = filtered.length + " مهمة";
}

function toggleTask(id) {
    const task = tasks.find(item => item.id === id);

    if (!task) return;

    task.completed = !task.completed;

    familyScores[task.user] = Math.max(
        0,
        (familyScores[task.user] || 0) + (task.completed ? EXP_PER_TASK : -EXP_PER_TASK)
    );

    saveStorage(STORAGE_KEYS.tasks, tasks);
    saveStorage(STORAGE_KEYS.scores, familyScores);

    renderTasks();
    updateDashboard();
    updateLeaderboard();
    updatePersonalProfile();

    if (task.completed && typeof confetti === "function") {
        confetti({
            particleCount: 65,
            spread: 65,
            origin: { y: 0.7 }
        });
    }
}

function deleteTask(id) {
    const task = tasks.find(item => item.id === id);

    if (!task || !confirm("هل تريد حذف هذه المهمة؟")) return;

    tasks = tasks.filter(item => item.id !== id);

    saveStorage(STORAGE_KEYS.tasks, tasks);
    renderTasks();
    updateDashboard();
}

function updateDashboard() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const percentage = total ? Math.round(completed / total * 100) : 0;

    const totalExp = Object.values(familyScores).reduce(
        (sum, points) => sum + (Number(points) || 0), 0
    );

    const setText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    setText("totalTasks", total);
    setText("completedTasks", completed);
    setText("remainingTasks", total - completed);
    setText("totalPoints", totalExp);
    setText("progressText", percentage + "%");

    const bar = document.getElementById("progressBar");
    if (bar) bar.style.width = percentage + "%";

    let message = "لنبدأ بإنجاز مهامنا اليوم!";

    if (percentage === 100 && total > 0) {
        message = "رائع! أنجزت العائلة جميع المهام 🎉";
    } else if (percentage >= 70) {
        message = "إنجاز ممتاز! اقتربتم من النهاية.";
    } else if (percentage >= 30) {
        message = "عمل رائع، استمروا معاً!";
    }

    setText("progressMessage", message);
}

function updateLeaderboard() {
    const leaderboard = document.getElementById("leaderboard");

    if (!leaderboard) return;

    leaderboard.replaceChildren();

    FAMILY_MEMBERS.filter(name => name !== "العائلة")
        .map(name => ({
            name,
            exp: familyScores[name] || 0
        }))
        .sort((a, b) => b.exp - a.exp)
        .forEach((member, index) => {
            const row = document.createElement("div");
            row.className = "leader-row";

            const rank = document.createElement("span");
            rank.className = "leader-rank";
            rank.textContent = ["🥇", "🥈", "🥉"][index] || String(index + 1);

            const nameWrap = document.createElement("div");
            nameWrap.className = "leader-name";

            const name = document.createElement("span");
            name.textContent = member.name;

            const level = document.createElement("small");
            level.className = "leader-level";
            level.textContent = "المستوى " + getLevel(member.exp).level;

            nameWrap.append(name, level);

            const points = document.createElement("span");
            points.className = "leader-points";
            points.textContent = "⭐ " + member.exp + " EXP";

            row.append(rank, nameWrap, points);
            leaderboard.appendChild(row);
        });
}

function updatePersonalProfile() {
    if (!currentUser) return;

    const exp = familyScores[currentUser] || 0;
    const info = getLevel(exp);

    const name = document.getElementById("personalName");
    if (name) name.textContent = currentUser;

    const level = document.getElementById("personalLevel");
    if (level) level.textContent = "المستوى " + info.level;

    const expElement = document.getElementById("personalExp");
    if (expElement) expElement.textContent = exp + " EXP";

    const bar = document.getElementById("personalLevelBar");
    if (bar) bar.style.width = info.percent + "%";

    const caption = document.getElementById("personalLevelCaption");

    if (caption) {
        caption.textContent =
            info.intoLevel + " / " + EXP_PER_LEVEL +
            " EXP للمستوى التالي — متبقٍ " + info.remaining;
    }
}

function initializeTheme() {
    const dark = localStorage.getItem(STORAGE_KEYS.theme) === "dark";

    document.body.classList.toggle("dark-theme", dark);
    updateThemeButton(dark);
}

function toggleDarkMode() {
    const dark = document.body.classList.toggle("dark-theme");

    localStorage.setItem(STORAGE_KEYS.theme, dark ? "dark" : "light");
    updateThemeButton(dark);
}

function updateThemeButton(dark) {
    const icon = document.getElementById("themeIcon");
    const label = document.getElementById("themeLabel");

    if (icon) icon.textContent = dark ? "☀️" : "🌙";
    if (label) label.textContent = dark ? "الوضع النهاري" : "الوضع الليلي";
}
