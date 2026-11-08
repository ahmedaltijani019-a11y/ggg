// ======================================
// 1. إعدادات Firebase والمكتبات السحابية
// ======================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, deleteDoc, onSnapshot, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDeuWVOzOs784lretb6GVByMspAY4EzN_k",
    authDomain: "family-b2c75.firebaseapp.com",
    projectId: "family-b2c75",
    storageBucket: "family-b2c75.firebasestorage.app",
    messagingSenderId: "321218921724",
    appId: "1:321218921724:web:85ffd3453b60ca6c798379",
    measurementId: "G-XJ38GSJBDE"
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
    "محمد",
    
];

const MEMBER_EMAILS = {
    "الوالد التجاني": "eltijani@family.com",
    "الوالدة تهاني": "tahani@family.com",
    "أحمد": "elssier@family.com",      // الإيميل الخاص بك المرتبط باسم العائلة
    "السر": "ahmed@family.com",       // إيميل السر
    "أسامة": "osama@family.com",
    "محمد": "mohamed@family.com"
};

let tasks = [];
let familyScores = {
    "الوالد التجاني": 0,
    "الوالدة تهاني": 0,
    "أحمد": 0,
    "السر": 0,
    "أسامة": 0,
    "محمد": 0,
    
};
let currentFilter = "all";
let currentLoggedInUser = null;

document.addEventListener("DOMContentLoaded", () => {
    initializeTheme();
    initializeEvents();

    onAuthStateChanged(auth, (user) => {
        const modal = document.getElementById("authModal");
        if (user) {
            currentLoggedInUser = Object.keys(MEMBER_EMAILS).find(key => MEMBER_EMAILS[key] === user.email) || "أحمد";
            modal.style.display = "none";
            document.getElementById("currentLoggedUserDisplay").textContent = `مرحباً، ${currentLoggedInUser} 👤`;
            initCloudSync();
        } else {
            modal.style.display = "grid";
            currentLoggedInUser = null;
        }
    });
});

window.handleLogin = async function() {
    const userSelect = document.getElementById("loginUserSelect").value;
    const rawPin = document.getElementById("loginPinInput").value.trim();
    const errorMsg = document.getElementById("authErrorMsg");

    if (!rawPin) {
        errorMsg.textContent = "الرجاء إدخال رمز الـ PIN الخاص بك.";
        return;
    }

    const email = MEMBER_EMAILS[userSelect];
    if (!email) {
        errorMsg.textContent = "حدث خطأ في تحديد الحساب.";
        return;
    }

    try {
        errorMsg.textContent = "جاري التحقق وتسجيل الدخول...";
        await signInWithEmailAndPassword(auth, email, rawPin);
        errorMsg.textContent = "";
        document.getElementById("loginPinInput").value = "";
    } catch (error) {
        console.error(error);
        errorMsg.textContent = "رمز الـ PIN غير صحيح (تأكد أنه 6 أرقام فأكثر).";
    }
};

window.handleLogout = function() {
    signOut(auth).then(() => {
        location.reload();
    });
};

async function initCloudSync() {
    await migrateLocalDataToCloudIfNeeded();

    onSnapshot(collection(db, "familyTasks"), (snapshot) => {
        tasks = [];
        snapshot.forEach((docSnap) => {
            let data = docSnap.data();
            tasks.push({
                id: docSnap.id,
                text: data.text,
                category: data.category,
                user: data.user,
                completed: data.completed
            });
        });
        renderTasks();
        updateDashboard();
    });

    onSnapshot(doc(db, "familyData", "scores"), (docSnap) => {
        if (docSnap.exists()) {
            familyScores = docSnap.data();
        }
        updateLeaderboard();
        updateDashboard();
    });
}

async function migrateLocalDataToCloudIfNeeded() {
    try {
        const localTasks = JSON.parse(localStorage.getItem("familyTasks")) || [];
        const scoresDocRef = doc(db, "familyData", "scores");
        const scoresSnap = await getDoc(scoresDocRef);

        if (!scoresSnap.exists() && localStorage.getItem("familyScores")) {
            const localScores = JSON.parse(localStorage.getItem("familyScores"));
            await setDoc(scoresDocRef, localScores);
        }

        if (localTasks.length > 0 && !localStorage.getItem("migratedToCloud")) {
            for (let t of localTasks) {
                await addDoc(collection(db, "familyTasks"), {
                    text: t.text,
                    category: t.category || "📌 أخرى",
                    user: t.user || "العائلة",
                    completed: Boolean(t.completed),
                    createdAt: Date.now()
                });
            }
            localStorage.setItem("migratedToCloud", "true");
        }
    } catch (e) {
        console.error("خطأ في الترحيل للسحابة:", e);
    }
}

function initializeEvents() {
    const form = document.getElementById("taskForm");

    form.addEventListener("submit", event => {
        event.preventDefault();
        addCloudTask();
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

    document.getElementById("taskList").addEventListener("change", event => {
        if (event.target.classList.contains("task-check")) {
            toggleCloudTask(event.target.dataset.id);
        }
    });

    document.getElementById("taskList").addEventListener("click", event => {
        const deleteButton = event.target.closest(".delete-btn");
        if (deleteButton) {
            deleteCloudTask(deleteButton.dataset.id);
        }
    });
}

async function addCloudTask() {
    const input = document.getElementById("taskInput");
    const category = document.getElementById("categorySelect").value;
    const user = document.getElementById("userSelect").value;
    const text = input.value.trim();

    if (!text) return;

    try {
        await addDoc(collection(db, "familyTasks"), {
            text,
            category,
            user,
            completed: false,
            createdAt: Date.now()
        });
        input.value = "";
        input.focus();
    } catch (e) {
        console.error("خطأ في إضافة المهمة:", e);
    }
}

async function toggleCloudTask(id) {
    const task = tasks.find(item => item.id === id);
    if (!task) return;

    const newCompletedState = !task.completed;
    const pointsChange = newCompletedState ? 10 : -10;

    try {
        await updateDoc(doc(db, "familyTasks", id), {
            completed: newCompletedState
        });

        familyScores[task.user] = Math.max(0, (familyScores[task.user] || 0) + pointsChange);
        await setDoc(doc(db, "familyData", "scores"), familyScores);

        if (newCompletedState && typeof confetti === "function") {
            confetti({ particleCount: 65, spread: 65, origin: { y: 0.7 } });
        }
    } catch (e) {
        console.error("خطأ في تحديث المهمة:", e);
    }
}

async function deleteCloudTask(id) {
    if (!confirm("هل تريد حذف هذه المهمة من السحابة؟")) return;

    try {
        await deleteDoc(doc(db, "familyTasks", id));
    } catch (e) {
        console.error("خطأ في الحذف:", e);
    }
}

function renderTasks() {
    const list = document.getElementById("taskList");
    const emptyState = document.getElementById("emptyState");

    list.replaceChildren();

    const filteredTasks = tasks.filter(task => {
        if (currentFilter === "pending") return !task.completed;
        if (currentFilter === "completed") return task.completed;
        return true;
    });

    emptyState.hidden = filteredTasks.length > 0;
    list.hidden = filteredTasks.length === 0;

    filteredTasks.forEach(task => {
        const item = document.createElement("li");
        item.className = "task-item";
        if (task.completed) item.classList.add("completed");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-check";
        checkbox.checked = task.completed;
        checkbox.dataset.id = task.id;

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

    document.getElementById("taskCount").textContent = filteredTasks.length + " مهمة";
}

function updateDashboard() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const remaining = total - completed;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    const totalPoints = Object.values(familyScores).reduce((sum, pts) => sum + pts, 0);

    document.getElementById("totalTasks").textContent = total;
    document.getElementById("completedTasks").textContent = completed;
    document.getElementById("remainingTasks").textContent = remaining;
    document.getElementById("totalPoints").textContent = totalPoints;

    document.getElementById("progressText").textContent = percentage + "%";
    document.getElementById("progressBar").style.width = percentage + "%";

    let message = "لنبدأ بإنجاز مهامنا اليوم!";
    if (percentage === 100 && total > 0) message = "رائع! أنجزت العائلة جميع المهام 🎉";
    else if (percentage >= 70) message = "إنجاز ممتاز! اقتربتم من النهاية.";
    else if (percentage >= 30) message = "عمل رائع، استمروا معاً!";

    document.getElementById("progressMessage").textContent = message;
}

function updateLeaderboard() {
    const leaderboard = document.getElementById("leaderboard");
    leaderboard.replaceChildren();

    const sortedMembers = FAMILY_MEMBERS
        .map(user => ({ name: user, points: familyScores[user] || 0 }))
        .sort((a, b) => b.points - a.points);

    sortedMembers.forEach((member, index) => {
        const row = document.createElement("div");
        row.className = "leader-row";

        const rank = document.createElement("span");
        rank.className = "leader-rank";
        rank.textContent = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1;

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

function initializeTheme() {
    const savedTheme = localStorage.getItem("familyTheme");
    const darkMode = savedTheme === "dark";
    document.body.classList.toggle("dark-theme", darkMode);
    updateThemeButton(darkMode);
}

window.toggleDarkMode = function() {
    const isDark = document.body.classList.toggle("dark-theme");
    localStorage.setItem("familyTheme", isDark ? "dark" : "light");
    updateThemeButton(isDark);
};

function updateThemeButton(isDark) {
    document.getElementById("themeIcon").textContent = isDark ? "☀️" : "🌙";
    document.getElementById("themeLabel").textContent = isDark ? "الوضع النهاري" : "الوضع الليلي";
}