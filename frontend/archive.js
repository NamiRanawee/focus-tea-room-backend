async function fetchArchivedTodos() {
    const res = await fetch('/api/todos/archive');
    const tasks = await res.json();
    renderArchive(tasks);
}

function renderArchive(tasks) {
    const archiveContainer = document.getElementById('archive-list');
    archiveContainer.innerHTML = '';

    if (tasks.length === 0) {
        archiveContainer.innerHTML = '<p style="text-align:center; color: #8A7E72;">No past records found.</p>';
        return;
    }

    // Group tasks by their created_date
    const groupedTasks = tasks.reduce((groups, task) => {
        const date = task.created_date;
        if (!groups[date]) groups[date] = [];
        groups[date].push(task);
        return groups;
    }, {});

    // Loop through each date group and create a cute badge + list
    for (const [date, dayTasks] of Object.entries(groupedTasks)) {
        const dateBlock = document.createElement('div');
        
        // Format the date nicely (e.g., "August 15, 2026")
        const dateObj = new Date(date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        dateBlock.innerHTML = `
            <div class="date-header">${formattedDate}</div>
            <ul>
                ${dayTasks.map(task => `
                    <li class="${task.completed ? 'completed' : ''}" style="cursor: default;">
                        <span class="checkbox"></span>
                        <span>${task.task}</span>
                    </li>
                `).join('')}
            </ul>
        `;
        archiveContainer.appendChild(dateBlock);
    }
}

fetchArchivedTodos();