const config = require('./config');

class NLUAgent {
  constructor() {
    this.apiKey = config.llm.apiKey;
    this.baseUrl = config.llm.baseUrl;
    this.model = config.llm.model;
  }

  async parseIntent(userInput, memory) {
    if (!this.apiKey) return { action: 'unknown', parameters: { text: userInput }, confidence: 0 };
    
    const prompt = `You are a todo assistant. Current todos: ${memory.recentTodos.map((t,i) => `${i+1}. ${t.text}`).join('\n')}
User: "${userInput}"
Return JSON: {"action": "add|complete|delete|list", "parameters": {}, "confidence": 0-1}`;

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages: [{role: 'user', content: prompt}], temperature: 0.1, response_format: { type: 'json_object' } })
      });
      const data = await res.json();
      return { ...JSON.parse(data.choices[0].message.content), matchedBy: 'llm' };
    } catch (e) {
      return { action: 'unknown', parameters: { text: userInput }, confidence: 0, error: e.message };
    }
  }
}

module.exports = new NLUAgent();
