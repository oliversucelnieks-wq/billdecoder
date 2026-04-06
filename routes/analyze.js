const express = require('express');
const router = express.Router();
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ANALYSIS_PROMPT = `You are a medical billing expert and patient advocate. Analyze this medical bill image carefully.

Extract and analyze every line item. For each charge:
1. Identify the procedure/service name and CPT code if visible
2. Check if the charge seems reasonable based on typical Medicare/insurance rates
3. Flag any suspicious patterns

Then provide a structured JSON response ONLY (no markdown, no backticks) with this exact format:
{
  "summary": {
    "totalCharged": 0,
    "estimatedFairValue": 0,
    "potentialOvercharge": 0,
    "errorCount": 0,
    "overallRisk": "low|medium|high"
  },
  "lineItems": [
    {
      "service": "service name",
      "cptCode": "code or null",
      "chargedAmount": 0,
      "estimatedFairAmount": 0,
      "flag": "ok|warning|error",
      "flagReason": "explanation or null"
    }
  ],
  "redFlags": [
    {
      "issue": "description of the problem",
      "severity": "low|medium|high",
      "action": "what the patient should do"
    }
  ],
  "disputeLetter": {
    "subject": "letter subject line",
    "body": "full dispute letter text ready to send"
  },
  "recommendations": [
    "actionable tip 1",
    "actionable tip 2"
  ]
}

Common red flags to look for:
- Duplicate charges (same service billed twice)
- Upcoding (billing for more complex service than performed)
- Unbundling (splitting procedures that should be billed together)
- Charges for services not received
- Charges significantly above Medicare rates (usually 2-5x)
- Missing itemization (lump sum charges with no breakdown)

If this does not appear to be a medical bill, return: {"error": "This does not appear to be a medical bill. Please upload a medical bill, EOB, or hospital statement."}`;

router.post('/', upload.single('bill'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No bill image uploaded' });
    }

    const base64Image = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Image }
            },
            { type: 'text', text: ANALYSIS_PROMPT }
          ]
        }
      ]
    });

    const rawText = response.content[0].text.trim();
    let analysis;
    try {
      analysis = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
      else throw new Error('Could not parse AI response');
    }

    if (analysis.error) return res.status(400).json({ error: analysis.error });
    res.json({ success: true, analysis });

  } catch (err) {
    console.error('Analysis error:', err);
    if (err.message === 'Only image files are allowed') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Analysis failed. Please try again.' });
  }
});

module.exports = router;