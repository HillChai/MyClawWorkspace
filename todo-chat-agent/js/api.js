window.API = (() => {
  const BASE_URL = window.API_BASE_URL || "http://localhost:3001";

  async function request(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, options);
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }

  return {
    listTodos() {
      return request("/api/todos");
    },
    createTodo(text) {
      return request("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
    },
    updateTodo(id, payload) {
      return request(`/api/todos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    },
    deleteTodo(id) {
      return request(`/api/todos/${id}`, { method: "DELETE" });
    },
    sendChat(message) {
      return request("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
    }
  };
})();
