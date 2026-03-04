const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function waitForServer(maxAttempts = 20, delayMs = 300) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch(`${BASE_URL}/api/todos`);
      if (res.ok) return;
    } catch (_e) {
      // ignore and retry
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Server not ready at ${BASE_URL}`);
}

async function run() {
  await waitForServer();

  const createRes = await fetch(`${BASE_URL}/api/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'test from test-api.js' })
  });
  const createJson = await createRes.json();
  if (!createRes.ok || !createJson.success) {
    throw new Error(`Create todo failed: ${JSON.stringify(createJson)}`);
  }

  const listRes = await fetch(`${BASE_URL}/api/todos`);
  const listJson = await listRes.json();
  if (!listRes.ok || !listJson.success || !Array.isArray(listJson.todos)) {
    throw new Error(`List todos failed: ${JSON.stringify(listJson)}`);
  }

  console.log('API test passed');
  console.log(`Created todo id: ${createJson.todo.id}`);
  console.log(`Total todos: ${listJson.todos.length}`);
}

run().catch((error) => {
  console.error('API test failed:', error.message);
  process.exit(1);
});
