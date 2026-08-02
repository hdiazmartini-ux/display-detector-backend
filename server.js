import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Verificar API key al iniciar
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('❌ ERROR: ANTHROPIC_API_KEY no está configurada en .env');
  process.exit(1);
}

console.log('✅ API Key configurada correctamente');

// ========== ENDPOINTS ==========

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Test API key
app.post('/api/test-key', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2024-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: 'Reply with just: OK'
        }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(401).json({ valid: false, error: 'Invalid API key' });
    }

    res.json({ valid: true, message: 'API key is valid' });
  } catch (error) {
    res.status(500).json({ valid: false, error: error.message });
  }
});

// Detect people in image
app.post('/api/detect', async (req, res) => {
  try {
    const { image, model, sensitivity } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const basePrompt = 'How many people (1-2 or more) are visible in this image? Reply with ONLY a number: 0, 1, 2, or 3+';
    
    let prompt = basePrompt;
    if (sensitivity === 'relaxed') {
      prompt = basePrompt + ' (Be sensitive to partial people)';
    } else if (sensitivity === 'strict') {
      prompt = basePrompt + ' (Only count clearly visible people)';
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2024-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: image
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Claude API Error:', error);
      return res.status(500).json({ error: 'Claude API error', details: error });
    }

    const data = await response.json();
    const content = data.content[0].text.trim();

    let detected = 0;
    if (content.includes('3')) detected = 3;
    else if (content.includes('2')) detected = 2;
    else if (content.includes('1')) detected = 1;
    else detected = 0;

    res.json({
      detected: detected,
      response: content,
      show_video: detected >= 1 && detected <= 2
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   Display Detector Backend - Listo    ║
║   Puerto: ${PORT}
║   API: ✅ Configurada
║   CORS: ✅ Habilitado
╚════════════════════════════════════════╝
  `);
});
// Deploy test
