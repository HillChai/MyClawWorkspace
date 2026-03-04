class RuleBasedNLU {
  constructor() {
    this.rules = [
      { name: 'add', patterns: [/^(添加|add|新建).{0,5}(.+)/i, /^(.+)$/], action: 'add', extract: m => ({ text: m[2] || m[1] }) },
      { name: 'complete_index', patterns: [/^(完成|done).*?(\d+).{0,3}个/i], action: 'complete', extract: m => ({ targetIndex: parseInt(m[2]) - 1 }) },
      { name: 'complete_last', patterns: [/^(那个|这个).{0,3}(完成|done)|^(完成|done)$/i], action: 'complete', extract: () => ({ target: 'last' }) },
      { name: 'delete_index', patterns: [/^(删除|delete|去掉).*?(\d+).{0,3}个/i], action: 'delete', extract: m => ({ targetIndex: parseInt(m[2]) - 1 }) },
      { name: 'list', patterns: [/^(列出|显示|list|所有)/i], action: 'list', extract: () => ({ filter: 'all' }) },
      { name: 'help', patterns: [/^(帮助|help|怎么用)/i], action: 'help', extract: () => ({}) }
    ];
  }

  parse(input) {
    const text = input.trim().toLowerCase();
    for (const rule of this.rules) {
      for (const pattern of rule.patterns) {
        const matches = text.match(pattern);
        if (matches) {
          return { action: rule.action, parameters: rule.extract(matches), confidence: 0.9, matchedRule: rule.name, originalInput: text };
        }
      }
    }
    return { action: 'unknown', parameters: { text }, confidence: 0, matchedRule: null, originalInput: text };
  }
}

module.exports = new RuleBasedNLU();
