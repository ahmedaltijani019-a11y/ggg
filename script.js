// استيراد Firebase من الروابط السحابية الرسمية (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, deleteDoc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// إعدادات مشروعك في Firebase التي نسختها
const firebaseConfig = {
    apiKey: "AIzaSyDeuWVOzOs784lretb6GVByMspAY4EzN_k",
    authDomain: "family-b2c75.firebaseapp.com",
    projectId: "family-b2c75",
    storageBucket: "family-b2c75.firebasestorage.app",
    messagingSenderId: "321218921724",
    appId: "1:321218921724:web:85ffd3453b60ca6c798379",
    measurementId: "G-XJ38GSJBDE"
};

// تهيئة Firebase و Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// هيكل النقاط المبدئي
let familyScores = {
    "الوالد التجاني": 0,
    "الوالدة تهاني": 0,
    "أحمد": 0,
    "السر": 0,
    "أسامة": 0,
    "محمد": 0,
    "العائلة": 0
};

document.addEventListener("DOMContentLoaded", () => {
    loadScoresFromFirestore();
    loadTasksFromFirestore();
});

// دالة إضافة مهمة جديدة للسحابة
window.addTask = async function() {
    let input = document.getElementById("taskInput");
    let categorySelect = document.getElementById("categorySelect");
    let userSelect = document.getElementById("userSelect");
    
    let taskText = input.value.trim();
    let category = categorySelect.value;
    let user = userSelect.value;

    if (taskText === "") {
        alert("الرجاء كتابة الطلب أو التذكير أولاً!");
        return;
    }

    try {
        // حفظ المهمة في سحابة Firestore
        await addDoc(collection(db, "familyTasks"), {
            text: taskText,
            category: category,
            user: user,
            completed: false,
            createdAt: Date.now()
        });

        input.value = "";
        confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
    } catch (e) {
        console.error("خطأ أثناء إضافة المهمة: ", e);
    }
};

// جلب المهام ومزامنتها لحظياً من سحابة Firestore
function loadTasksFromFirestore() {
    const taskList = document.getElementById("taskList");
    
    onSnapshot(collection(db, "familyTasks"), (snapshot) => {
        taskList.innerHTML = "";
        snapshot.forEach((docSnap) => {
            let task = docSnap.data();
            let taskId = docSnap.id;
            createTaskElement(taskId, task.text, task.category, task.user, task.completed);
        });
        updateProgress();
    });
}

function createTaskElement(taskId, taskText, category, user, isCompleted) {
    let taskList = document.getElementById("taskList");
    let li = document.createElement("li");
    
    let contentSpan = document.createElement("span");
    contentSpan.innerHTML = `<span class="category-tag">${category}</span> <span class="user-tag">👤 ${user}</span> ${taskText}`;
    li.appendChild(contentSpan);

    if (isCompleted) {
        li.classList.add("completed");
    }

    // عند النقر لإتمام المهمة
    li.onclick = async function() {
        let wasCompleted = li.classList.contains("completed");
        let isNowCompleted = !wasCompleted;

        // تحديث الحالة في السحابة
        await updateDoc(doc(db, "familyTasks", taskId), {
            completed: isNowCompleted
        });

        if (!wasCompleted && isNowCompleted) {
            addPoints(user, 10);
            confetti({ particleCount: 60, spread: 60, origin: { y: 0.8 } });
        } else if (wasCompleted && !isNowCompleted) {
            addPoints(user, -10);
        }
    };

    let deleteBtn = document.createElement("button");
    deleteBtn.textContent = "حذف";
    deleteBtn.className = "delete-btn";
    
    deleteBtn.onclick = async function(e) {
        e.stopPropagation();
        await deleteDoc(doc(db, "familyTasks", taskId));
    };

    li.appendChild(deleteBtn);
    taskList.appendChild(li);
}

// تحديث وحفظ النقاط في السحابة
async function addPoints(user, points) {
    if (familyScores.hasOwnProperty(user)) {
        familyScores[user] = Math.max(0, (familyScores[user] || 0) + points);
    } else {
        familyScores[user] = Math.max(0, points);
    }

    // حفظ النقاط في مستند واحد داخل Firestore
    try {
        await setDoc(doc(db, "familyData", "scores"), familyScores);
    } catch (e) {
        console.error("خطأ في تحديث النقاط: ", e);
    }
    updateLeaderboardUI();
}

// جلب النقاط من السحابة
function loadScoresFromFirestore() {
    onSnapshot(doc(db, "familyData", "scores"), (docSnap) => {
        if (docSnap.exists()) {
            familyScores = docSnap.data();
        }
        updateLeaderboardUI();
    });
}

function updateLeaderboardUI() {
    let leaderboard = document.getElementById("leaderboard");
    if (!leaderboard) return;

    leaderboard.innerHTML = "";
    for (let user in familyScores) {
        let box = document.createElement("div");
        box.className = "user-score-box";
        box.innerHTML = `
            <span class="user-score-name">${user}</span>
            <span class="user-score-points">⭐ ${familyScores[user]}</span>
        `;
        leaderboard.appendChild(box);
    }
}

function updateProgress() {
    let allTasks = document.querySelectorAll("#taskList li");
    let completedTasks = document.querySelectorAll("#taskList li.completed");
    
    let total = allTasks.length;
    let completed = completedTasks.length;
    let percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    let progressBar = document.getElementById("progressBar");
    let progressText = document.getElementById("progressText");

    if (progressBar && progressText) {
        progressBar.style.width = percentage + "%";
        progressText.textContent = percentage + "%";
    }
}

window.toggleDarkMode = function() {
    document.body.classList.toggle("dark-theme");
};

// دعم الضغط على زر Enter لإضافة مهمة
let taskInputEl = document.getElementById("taskInput");
if(taskInputEl) {
    taskInputEl.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            window.addTask();
        }
    });
}