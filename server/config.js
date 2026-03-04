/**
 * 配置文件
 */
const path = require('path');

module.exports = {
  port: process.env.PORT || 3001,
  dbPath: process.env.DB_PATH || path.join(__dirname, '../data/todos.db'),
  llm: {
    apiKey: process.env.LLM_API_KEY || '',
    baseUrl: process.env.LLM_BASE_URL || 'https://api.moonshot.cn/v1',
    model: process.env.LLM_MODEL || 'kimi-k2.5',
    temperature: 0.1,
    maxTokens: 500
  },
  memory: {
    dataDir: path.join(__dirname, 'memory/data'),
    maxContextTodos: 10,
    minConfidence: 0.7,
    autoLearnThreshold: 3
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }
};
