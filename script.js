document.addEventListener("DOMContentLoaded", () => {
    loadTasks();
    updateLeaderboardUI();
});

// قائمة أفراد العائلة والنقاط المبدئية
let familyScores = JSON.parse(localStorage.getItem("familyScores")) || {
    "الوالد التجاني": 0,
    "الوالدة تهاني": 0,
    "أحمد": 0,
    "السر": 0,
    "أسامة": 0,
    "محمد": 0,
    "العائلة": 0
};

function addTask() {
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

    createTaskElement(taskText, category, user, false);
    saveTaskToLocalStorage(taskText, category, user, false);

    input.value = "";
    
    confetti({
        particleCount: 50,
        spread: 50,
        origin: { y: 0.7 }
    });

    updateProgress();
}

function createTaskElement(taskText, category, user, isCompleted) {
    let li = document.createElement("li");
    
    let contentSpan = document.createElement("span");
    contentSpan.innerHTML = `<span class="category-tag">${category}</span> <span class="user-tag">👤 ${user}</span> ${taskText}`;
    li.appendChild(contentSpan);

    if (isCompleted) {
        li.classList.add("completed");
    }

    li.onclick = function() {
        let wasCompleted = li.classList.contains("completed");
        li.classList.toggle("completed");
        let isNowCompleted = li.classList.contains("completed");

        updateTaskStateInLocalStorage(taskText, isNowCompleted);
        
        // تعديل النقاط عند الضغط على المهمة
        if (!wasCompleted && isNowCompleted) {
            addPoints(user, 10); // زيادة 10 نقاط
            confetti({
                particleCount: 60,
                spread: 60,
                origin: { y: 0.8 }
            });
        } else if (wasCompleted && !isNowCompleted) {
            addPoints(user, -10); // خصم 10 نقاط إذا ألغى التحديد
        }

        updateProgress();
    };

    let deleteBtn = document.createElement("button");
    deleteBtn.textContent = "حذف";
    deleteBtn.className = "delete-btn";
    
    deleteBtn.onclick = function(e) {
        e.stopPropagation();
        li.remove();
        removeTaskFromLocalStorage(taskText);
        updateProgress();
    };

    li.appendChild(deleteBtn);
    document.getElementById("taskList").appendChild(li);
    updateProgress();
}

function addPoints(user, points) {
    if (familyScores.hasOwnProperty(user)) {
        familyScores[user] = Math.max(0, (familyScores[user] || 0) + points);
    } else {
        familyScores[user] = Math.max(0, points);
    }
    localStorage.setItem("familyScores", JSON.stringify(familyScores));
    updateLeaderboardUI();
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

function saveTaskToLocalStorage(taskText, category, user, isCompleted) {
    let tasks = JSON.parse(localStorage.getItem("familyTasks")) || [];
    tasks.push({ text: taskText, category: category, user: user, completed: isCompleted });
    localStorage.setItem("familyTasks", JSON.stringify(tasks));
}

function loadTasks() {
    let tasks = JSON.parse(localStorage.getItem("familyTasks")) || [];
    tasks.forEach(task => createTaskElement(task.text, task.category || "عام", task.user || "العائلة", task.completed));
    updateProgress();
}

function updateTaskStateInLocalStorage(taskText, isCompleted) {
    let tasks = JSON.parse(localStorage.getItem("familyTasks")) || [];
    tasks.forEach(task => {
        if (task.text === taskText) {
            task.completed = isCompleted;
        }
    });
    localStorage.setItem("familyTasks", JSON.stringify(tasks));
}

function removeTaskFromLocalStorage(taskText) {
    let tasks = JSON.parse(localStorage.getItem("familyTasks")) || [];
    tasks = tasks.filter(t => t.text !== taskText);
    localStorage.setItem("familyTasks", JSON.stringify(tasks));
}

function toggleDarkMode() {
    document.body.classList.toggle("dark-theme");
}

document.getElementById("taskInput").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        addTask();
    }
});