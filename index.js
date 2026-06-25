const express = require('express');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Webhook verification
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// Receive messages
app.post('/webhook', async (req, res) => {
  const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message || message.type !== 'text') return res.sendStatus(200);

  const userText = message.text.body;
  const from = message.from;

  // Call Claude
  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: `You are a helpful Japan travel assistant for Israeli tourists. You answer questions about traveling in Japan — transportation, accommodations, food, culture, itineraries, and seasonal tips. Be warm, concise, and practical. You can respond in Hebrew or English depending on what the user writes.`,
      messages: [{ role: 'user', content: userText }]
    })
  });

  const claudeData = await claudeRes.json();
  const reply = claudeData.content?.[0]?.text || 'Sorry, I could not process that.';

  // Send reply via WhatsApp
  await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: from,
      text: { body: reply }
    })
  });

  res.sendStatus(200);
});

app.listen(3000, () => console.log('Server running'));
