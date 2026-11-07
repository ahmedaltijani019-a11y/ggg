
// ======================================
// 1. إعدادات الموقع والبيانات
// ======================================

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
    theme: "familyTheme"
};

function readStorage(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (error) {
        console.error("Storage read error:", error);
        return fallback;
    }
}

function saveStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error("Storage save error:", error);
        alert("تعذر حفظ البيانات. تحقق من مساحة التخزين في المتصفح.");
    }
}

function createId() {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return Date.now().toString(36) +
        Math.random().toString(36).slice(2);
}

// تحميل المهام القديمة مع دعم البيانات السابقة
let tasks = readStorage(STORAGE_KEYS.tasks, []);

if (!Array.isArray(tasks)) {
    tasks = [];
}

tasks = tasks.map(task => ({
    id: task.id || createId(),
    text: String(task.text || ""),
    category: task.category || "📌 أخرى",
    user: FAMILY_MEMBERS.includes(task.user) ? task.user : "العائلة",
    completed: Boolean(task.completed)
})).filter(task => task.text);

saveStorage(STORAGE_KEYS.tasks, tasks);

// تحميل النقاط القديمة والمحافظة عليها
let familyScores = readStorage(STORAGE_KEYS.scores, {});

if (!familyScores || typeof familyScores !== "object" || Array.isArray(familyScores)) {
    familyScores = {};
}

FAMILY_MEMBERS.forEach(user => {
    const score = Number(familyScores[user]);
    familyScores[user] = Number.isFinite(score)
        ? Math.max(0, score)
        : 0;
});

saveStorage(STORAGE_KEYS.scores, familyScores);

let currentFilter = "all";

// ======================================
// 2. تشغيل الموقع
// ======================================

document.addEventListener("DOMContentLoaded", () => {
    initializeTheme();
    initializeEvents();
    renderTasks();
    updateDashboard();
    updateLeaderboard();
});

// ======================================
// 3. الأحداث
// ======================================

function initializeEvents() {
    const form = document.getElementById("taskForm");

    form.addEventListener("submit", event => {
        event.preventDefault();
        addTask();
    });

    document.getElementById("themeToggle").addEventListener("click", toggleDarkMode);

    document.querySelectorAll(".filter-btn").forEach(button => {
        button.addEventListener("click", () => {
            currentFilter = button.dataset.filter;

            document.querySelectorAll(".filter-btn").forEach(btn => {
                btn.classList.toggle("active", btn === button);
            });

            renderTasks();
        });
    });

    // استخدام التفويض للأحداث الخاصة بالمهام
    document.getElementById("taskList").addEventListener("change", event => {
        if (event.target.classList.contains("task-check")) {
            toggleTask(event.target.dataset.id);
        }
    });

    document.getElementById("taskList").addEventListener("click", event => {
        const deleteButton = event.target.closest(".delete-btn");

        if (deleteButton) {
            deleteTask(deleteButton.dataset.id);
        }
    });
}

// ======================================
// 4. إضافة مهمة جديدة
// ======================================

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

    const newTask = {
        id: createId(),
        text,
        category,
        user,
        completed: false
    };

    tasks.unshift(newTask);

    saveStorage(STORAGE_KEYS.tasks, tasks);

    input.value = "";
    renderTasks();
    updateDashboard();

    input.focus();
}

// ======================================
// 5. عرض المهام
// ======================================

function renderTasks() {
    const list = document.getElementById("taskList");
    const emptyState = document.getElementById("emptyState");

    list.replaceChildren();

    const filteredTasks = tasks.filter(task => {
        if (currentFilter === "pending") {
            return !task.completed;
        }

        if (currentFilter === "completed") {
            return task.completed;
        }

        return true;
    });

    emptyState.hidden = filteredTasks.length > 0;
    list.hidden = filteredTasks.length === 0;

    filteredTasks.forEach(task => {
        const item = document.createElement("li");
        item.className = "task-item";

        if (task.completed) {
            item.classList.add("completed");
        }

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
        list.appendChild(item);
    });

    document.getElementById("taskCount").textContent =
        filteredTasks.length + " مهمة";
}

// ======================================
// 6. إكمال المهمة ونظام النقاط
// ======================================

function toggleTask(id) {
    const task = tasks.find(item => item.id === id);

    if (!task) return;

    task.completed = !task.completed;

    // 10 نقاط عند الإكمال وخصمها عند إلغاء الإكمال
    const points = task.completed ? 10 : -10;

    familyScores[task.user] = Math.max(
        0,
        (familyScores[task.user] || 0) + points
    );

    saveStorage(STORAGE_KEYS.tasks, tasks);
    saveStorage(STORAGE_KEYS.scores, familyScores);

    renderTasks();
    updateDashboard();
    updateLeaderboard();

    if (task.completed && typeof confetti === "function") {
        confetti({
            particleCount: 65,
            spread: 65,
            origin: { y: 0.7 }
        });
    }
}

// ======================================
// 7. حذف المهمة
// ======================================

function deleteTask(id) {
    const task = tasks.find(item => item.id === id);

    if (!task) return;

    const confirmed = confirm("هل تريد حذف هذه المهمة؟");

    if (!confirmed) return;

    // النقاط المكتسبة سابقاً تبقى محفوظة
    tasks = tasks.filter(item => item.id !== id);

    saveStorage(STORAGE_KEYS.tasks, tasks);

    renderTasks();
    updateDashboard();
}

// ======================================
// 8. تحديث الإحصائيات ونسبة الإنجاز
// ======================================

function updateDashboard() {
    const total = tasks.length;

    const completed = tasks.filter(task => task.completed).length;

    const remaining = total - completed;

    const percentage = total === 0
        ? 0
        : Math.round((completed / total) * 100);

    const totalPoints = Object.values(familyScores)
        .reduce((sum, points) => sum + points, 0);

    document.getElementById("totalTasks").textContent = total;
    document.getElementById("completedTasks").textContent = completed;
    document.getElementById("remainingTasks").textContent = remaining;
    document.getElementById("totalPoints").textContent = totalPoints;

    document.getElementById("progressText").textContent =
        percentage + "%";

    document.getElementById("progressBar").style.width =
        percentage + "%";

    let message = "لنبدأ بإنجاز مهامنا اليوم!";

    if (percentage === 100 && total > 0) {
        message = "رائع! أنجزت العائلة جميع المهام 🎉";
    } else if (percentage >= 70) {
        message = "إنجاز ممتاز! اقتربتم من النهاية.";
    } else if (percentage >= 30) {
        message = "عمل رائع، استمروا معاً!";
    }

    document.getElementById("progressMessage").textContent = message;
}

// ======================================
// 9. لوحة متصدري النقاط
// ======================================

function updateLeaderboard() {
    const leaderboard = document.getElementById("leaderboard");

    leaderboard.replaceChildren();

    const sortedMembers = FAMILY_MEMBERS
        .map(user => ({
            name: user,
            points: familyScores[user] || 0
        }))
        .sort((a, b) => b.points - a.points);

    sortedMembers.forEach((member, index) => {
        const row = document.createElement("div");
        row.className = "leader-row";

        const rank = document.createElement("span");
        rank.className = "leader-rank";

        rank.textContent = index === 0
            ? "🥇"
            : index === 1
                ? "🥈"
                : index === 2
                    ? "🥉"
                    : index + 1;

        const name = document.createElement("span");
        name.className = "leader-name";
        name.textContent = member.name;

        const points = document.createElement("span");
        points.className = "leader-points";
        points.textContent = "⭐ " + member.points;

        row.append(rank, name, points);
        leaderboard.appendChild(row);
    });
}

// ======================================
// 10. الوضع الليلي والنهاري
// ======================================

function initializeTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);

    const darkMode = savedTheme === "dark";

    document.body.classList.toggle("dark-theme", darkMode);

    updateThemeButton(darkMode);
}

function toggleDarkMode() {
    const isDark = document.body.classList.toggle("dark-theme");

    localStorage.setItem(
        STORAGE_KEYS.theme,
        isDark ? "dark" : "light"
    );

    updateThemeButton(isDark);
}

function updateThemeButton(isDark) {
    document.getElementById("themeIcon").textContent =
        isDark ? "☀️" : "🌙";

    document.getElementById("themeLabel").textContent =
        isDark ? "الوضع النهاري" : "الوضع الليلي";
}
