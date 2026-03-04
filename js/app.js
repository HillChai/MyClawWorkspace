(function () {
  const listEl = document.getElementById("todo-list");
  const addForm = document.getElementById("add-form");
  const todoInput = document.getElementById("todo-input");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatOutput = document.getElementById("chat-output");

  async function renderTodos() {
    const { todos } = await window.API.listTodos();
    listEl.innerHTML = "";

    if (!todos.length) {
      listEl.innerHTML = '<li class="item">暂无待办事项</li>';
      return;
    }

    todos.forEach((todo) => {
      const li = document.createElement("li");
      li.className = `item ${todo.completed ? "done" : ""}`;
      li.innerHTML = `
        <span class="text">${escapeHtml(todo.text)}</span>
        <div class="actions">
          <button class="secondary" data-action="toggle" data-id="${todo.id}">
            ${todo.completed ? "撤销" : "完成"}
          </button>
          <button class="secondary" data-action="delete" data-id="${todo.id}">删除</button>
        </div>
      `;
      listEl.appendChild(li);
    });
  }

  function escapeHtml(text) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = todoInput.value.trim();
    if (!text) return;
    await window.API.createTodo(text);
    todoInput.value = "";
    await renderTodos();
  });

  listEl.addEventListener("click", async (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === "delete") {
      await window.API.deleteTodo(id);
    }
    if (action === "toggle") {
      const row = button.closest(".item");
      const completed = !row.classList.contains("done");
      await window.API.updateTodo(id, { completed });
    }
    await renderTodos();
  });

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;

    try {
      const result = await window.API.sendChat(message);
      chatOutput.textContent = JSON.stringify(result, null, 2);
      chatInput.value = "";
      await renderTodos();
    } catch (error) {
      chatOutput.textContent = `调用失败: ${error.message}`;
    }
  });

  renderTodos().catch((error) => {
    chatOutput.textContent = `初始化失败: ${error.message}`;
  });
})();
