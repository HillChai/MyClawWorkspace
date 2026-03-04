const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const config = require('./config');
const dbManager = require('./database');
const actions = require('./actions');
const ruleNLU = require('./nlu');
const nluAgent = require('./nlu-agent');

const app = express();
app.use(cors(config.cors));
app.use(bodyParser.json());

// REST API
app.get('/api/todos', async (req, res) => {
  const todos = await actions.getAll({
    completed: req.query.completed === 'true' ? true : req.query.completed === 'false' ? false : undefined,
    search: req.query.q
  });
  res.json({ success: true, todos });
});

app.post('/api/todos', async (req, res) => {
  if (!req.body.text) return res.status(400).json({ success: false, error: 'text required' });
  const todo = await actions.create(req.body);
  res.status(201).json({ success: true, todo });
});

app.put('/api/todos/:id', async (req, res) => {
  const todo = await actions.update(req.params.id, req.body);
  todo ? res.json({ success: true, todo }) : res.status(404).json({ success: false, error: 'Not found' });
});

app.delete('/api/todos/:id', async (req, res) => {
  const todo = await actions.delete(req.params.id);
  todo ? res.json({ success: true, todo }) : res.status(404).json({ success: false, error: 'Not found' });
});

// Chat API
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'message required' });

    const memory = { recentTodos: (await actions.getAll()).slice(0, 10) };
    let result = ruleNLU.parse(message);
    let matchedBy = 'rule';

    if (result.confidence < config.memory.minConfidence) {
      const llmResult = await nluAgent.parseIntent(message, memory);
      if (llmResult.confidence > result.confidence) { result = llmResult; matchedBy = 'llm'; }
    }

    const exec = await executeAction(result);
    res.json({ success: true, action: result.action, matchedBy, message: exec.message, data: exec.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

async function executeAction(parseResult) {
  const { action, parameters } = parseResult;
  switch (action) {
    case 'add': {
      const todo = await actions.create({ text: parameters.text, priority: parameters.priority || 1, tags: parameters.tags || [] });
      return { message: `✅ Added: "${todo.text}"`, data: { todo } };
    }
    case 'complete': {
      let todo;
      if (parameters.targetIndex !== undefined) {
        const todos = await actions.getAll({ completed: false });
        if (todos[parameters.targetIndex]) todo = await actions.toggle(todos[parameters.targetIndex].id);
      } else if (parameters.target === 'last') {
        const todos = await actions.getAll({ completed: false });
        if (todos[0]) todo = await actions.toggle(todos[0].id);
      }
      return todo ? { message: `✅ Completed: "${todo.text}"`, data: { todo } } : { message: '❌ Todo not found', data: null };
    }
    case 'delete': {
      let todo;
      if (parameters.targetIndex !== undefined) {
        const todos = await actions.getAll();
        if (todos[parameters.targetIndex]) todo = await actions.delete(todos[parameters.targetIndex].id);
      }
      return todo ? { message: `🗑️ Deleted: "${todo.text}"`, data: { todo } } : { message: '❌ Todo not found', data: null };
    }
    case 'list': {
      const todos = await actions.getAll();
      return { message: `📋 ${todos.length} todo(s)`, data: { todos } };
    }
    default:
      return { message: '🤔 I did not understand. Try: "Add buy milk" or "List all"', data: null };
  }
}

// Start
async function start() {
  await dbManager.init();
  app.listen(config.port, () => {
    console.log(`🚀 Server: http://localhost:${config.port}`);
    console.log(`💾 Database: ${config.dbPath}`);
    console.log(`🤖 LLM: ${config.llm.model || 'not configured'}`);
  });
}

start().catch(console.error);
