async function fetchArchivedTodos() {
    const res = await fetch('/api/todos/archive');
    const tasks = await res.json();
    const archiveContainer = document.getElementById('archive-list');
    
    // The Cute "Empty State" from the screenshot
    if (tasks.length === 0) {
        archiveContainer.innerHTML = `
            <div style="font-size: 80px; margin-bottom: 20px;">🧸</div>
            <h2 style="color: var(--text-dark); margin: 0;">No past tasks yet!</h2>
            <p style="color: var(--text-muted); font-size: 15px;">Complete some to-dos on your dashboard first.</p>
        `;
        return;
    }

    archiveContainer.innerHTML = '';
    const groupedTasks = tasks.reduce((groups, task) => {
        if (!groups[task.created_date]) groups[task.created_date] = [];
        groups[task.created_date].push(task);
        return groups;
    }, {});

    for (const [date, dayTasks] of Object.entries(groupedTasks)) {
        const dateObj = new Date(date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        
        archiveContainer.innerHTML += `
            <div class="cute-card" style="margin-bottom: 30px; text-align: left;">
                <h3 style="color: var(--primary); margin-top: 0;">${formattedDate}</h3>
                ${dayTasks.map(task => `
                    <div class="task-item completed" style="background: var(--bg-main); border: none; cursor: default;">
                        <div class="task-left">
                            <div class="task-checkbox" style="background: var(--primary);"></div>
                            <span>${task.task}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}
fetchArchivedTodos();