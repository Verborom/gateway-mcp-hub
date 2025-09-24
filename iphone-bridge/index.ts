/**
 * iPhone Voice Bridge for MCP Gateway
 * Provides voice interface through ElevenLabs and push notifications
 */

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import twilio from 'twilio';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8080;
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3456';

// Twilio client for SMS notifications
const twilioClient = process.env.TWILIO_ACCOUNT_SID ? 
  twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

// ElevenLabs TTS
async function textToSpeech(text: string): Promise<Buffer> {
  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });
  
  return Buffer.from(await response.arrayBuffer());
}

// Send SMS notification
async function sendNotification(message: string) {
  if (!twilioClient) return;
  
  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.USER_PHONE_NUMBER!,
    });
  } catch (error) {
    console.error('SMS notification failed:', error);
  }
}

// Endpoints for iPhone app
app.post('/voice-command', async (req, res) => {
  const { text, urgency = 'normal' } = req.body;
  
  try {
    // Queue command to gateway
    const response = await fetch(`${GATEWAY_URL}/api/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'voice',
        command: text,
        args: { source: 'iphone', urgency },
      }),
    });
    
    const result = await response.json();
    
    // Generate voice response
    const responseText = `Command queued. ID: ${result.id.slice(-6)}`;
    const audio = await textToSpeech(responseText);
    
    res.json({
      id: result.id,
      text: responseText,
      audio: audio.toString('base64'),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process command' });
  }
});

app.get('/status/:id', async (req, res) => {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/status/${req.params.id}`);
    const status = await response.json();
    
    if (status.status === 'completed') {
      // Send notification
      await sendNotification(`Task ${req.params.id.slice(-6)} completed: ${status.result?.slice(0, 100)}`);
    }
    
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});

app.post('/ask-claude', async (req, res) => {
  const { prompt, context = [] } = req.body;
  
  try {
    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        messages: [
          ...context,
          { role: 'user', content: prompt },
        ],
        max_tokens: 1000,
      }),
    });
    
    const result = await response.json();
    const responseText = result.content[0].text;
    
    // Convert to speech
    const audio = await textToSpeech(responseText);
    
    res.json({
      text: responseText,
      audio: audio.toString('base64'),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to communicate with Claude' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`📱 iPhone Bridge running on port ${PORT}`);
  console.log(`🔊 ElevenLabs: ${process.env.ELEVENLABS_API_KEY ? 'Connected' : 'Not configured'}`);
  console.log(`📨 Twilio SMS: ${twilioClient ? 'Connected' : 'Not configured'}`);
});
