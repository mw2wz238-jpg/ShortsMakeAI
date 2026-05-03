import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenAI, Type } from '@google/genai';
import ytdl from '@distube/ytdl-core';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';

async function startServer() {
  const app = express();
  app.use(express.json());
const rendersDir = path.join(process.cwd(), 'renders');
if (!fs.existsSync(rendersDir)) {
  fs.mkdirSync(rendersDir, { recursive: true });
}

app.use('/renders', express.static(rendersDir));

// Store progress in memory for simple polling
const renderProgress: Record<string, any> = {};

app.get('/api/functions/render-progress', (req, res) => {
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' });
  res.json(renderProgress[id] || { status: 'idle' });
});

app.post('/api/functions/render-video', async (req, res) => {
  const { jobId, shortIndex, short, url } = req.body;
  if (!jobId || shortIndex === undefined || !short || !url) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const renderId = `${jobId}-${shortIndex}`;
  renderProgress[renderId] = { status: 'rendering', progress: 0 };
  res.json({ ok: true, renderId }); // Return immediately to let frontend poll

  // Background rendering process
  try {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);

    const outputPath = path.join(rendersDir, `${renderId}.mp4`);

    // Create FFmpeg filters based on Blueprint
    const filters = [];
    
    // 1. Crop to 9:16 using crop_x_center
    const cx = short.crop_x_center !== undefined ? short.crop_x_center : 0.5;
    filters.push(`crop=w='ih*9/16':h='ih':x='(iw-ih*9/16)*${cx}':y=0`);

    // 2. Zoom (simplified generic zoom using scale & crop if requested)
    if (short.zoom_points && short.zoom_points.length > 0) {
       const initialZoom = short.zoom_points[0].scale || 1.1;
       filters.push(`scale=iw*${initialZoom}:ih*${initialZoom}`);
       filters.push(`crop=w='iw/${initialZoom}':h='ih/${initialZoom}':x='(iw-iw/${initialZoom})/2':y='(ih-ih/${initialZoom})/2'`);
    }

    // 3. Captions (hardcoded into video using drawtext)
    if (short.captions && short.captions.length > 0) {
       const fontColor = short.captionColor?.replace('#', '') || 'white';
       for (const cap of short.captions) {
          const escapedText = cap.text.replace(/'/g, '').replace(/:/g, '\\\\:'); 
          // add karaoke pseudo-effect by slightly scaling or changing color, but for simplicity we rely on basic FFmpeg drawtext
          filters.push(`drawtext=text='${escapedText}':fontcolor=${fontColor}:fontsize=48:x='(w-text_w)/2':y='h-150':enable='between(t,${cap.start - short.start},${cap.end - short.start})'`);
       }
    }

    // 4. Overlays & Filters (watermark, color adjust)
    if (short.watermark) {
       filters.push(`drawtext=text='@${short.watermark}':fontcolor=white@0.5:fontsize=24:x=w-nw-20:y=20`);
    }

    if (short.filter === 'brighten') {
       filters.push(`eq=brightness=0.1:contrast=1.1:saturation=1.2`);
    }

    // FFmpeg can read directly from an http/https URL if compiled with support, 
    // but just in case, let's let FFmpeg retrieve the file from Firebase Storage URL.
    ffmpeg()
      .input(url)
      .setStartTime(short.start)
      .setDuration(short.end - short.start)
      .videoFilters(filters)
      .outputOptions('-c:v libx264')
      .outputOptions('-preset fast')
      .outputOptions('-crf 23')
      .on('progress', (progress) => {
        const curProgress = Math.round(progress.percent || 0);
        renderProgress[renderId] = { status: 'rendering', progress: curProgress };
      })
      .on('end', () => {
        renderProgress[renderId] = { status: 'finished', finalVideoUrl: `/renders/${renderId}.mp4` };
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        renderProgress[renderId] = { status: 'error', error: err.message };
      })
      .save(outputPath);

  } catch (error) {
    console.error('Render initialization error:', error);
    renderProgress[renderId] = { status: 'error', error: error instanceof Error ? error.message : String(error) };
  }
});

  // Backend API to extract shorts over the server
  app.post('/api/functions/extract-shorts', async (req, res) => {
    const { videoUrl, fileName, settings } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({ error: 'Missing videoUrl parameter' });
    }

    try {
      const tempId = crypto.randomUUID();
      const ext = path.extname(fileName || 'video.mp4') || '.mp4';
      const tempPath = path.join(rendersDir, `temp_${tempId}${ext}`);
      
      // Download the video from Firebase Storage URL
      const fetchRes = await fetch(videoUrl);
      if (!fetchRes.ok) throw new Error(`Failed to fetch video from storage: ${fetchRes.statusText}`);
      
      const fileStream = fs.createWriteStream(tempPath);
      if (fetchRes.body) {
        // use Web API stream to Node stream
        // @ts-ignore
        const nodeStream = require('stream').Readable.fromWeb(fetchRes.body);
        await new Promise((resolve, reject) => {
          nodeStream.pipe(fileStream);
          nodeStream.on('error', reject);
          fileStream.on('finish', resolve);
        });
      } else {
        throw new Error("No body in fetch response");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Upload to Gemini
      const uploadResult = await ai.files.upload({ file: tempPath, mimeType: 'video/mp4' });

      // Poll until the file is active (if it needs processing)
      let fileState = await ai.files.get({ name: uploadResult.name });
      while (fileState.state === 'PROCESSING') {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        fileState = await ai.files.get({ name: uploadResult.name });
      }

      if (fileState.state === 'FAILED') {
        throw new Error('Video processing failed in Gemini.');
      }

      const platformMap: Record<string, string> = {
        tiktok: 'TikTok (fast-paced, highly engaging hooks)',
        youtube_shorts: 'YouTube Shorts (attention-grabbing, algorithmic focus)',
        reels: 'Instagram Reels (aesthetic, relatable or educational)'
      };

      const durationMap: Record<string, string> = {
        under_60s: 'Maximum 60 seconds per segment',
        under_30s: 'Maximum 30 seconds per segment',
        any: 'Any suitable length'
      };

      const focusMap: Record<string, string> = {
        humor: 'funny moments, jokes, and reactions',
        educational: 'insightful explanations, tutorials, and facts',
        engaging_hook: 'strong opening hooks, controversies, and story peaks',
        any: 'the generally best moments'
      };

      const outLang = settings?.outputLanguage || 'en';

      const prompt = `Identify the 3 most engaging segments of this video optimized for ${platformMap[settings?.targetPlatform || 'tiktok']}. 
Focus primarily on finding ${focusMap[settings?.focus || 'engaging_hook']}. 
Constraint: ${durationMap[settings?.durationLimit || 'under_60s']}.
Provide exact start/end timestamps (in seconds) and justify why they are engaging. 
CRITICAL: The generated \`title\` and \`description\` properties in the JSON response MUST be written in the following language: ${outLang}.

UNIQUE REQUIREMENT: You are also the "Viral Architect" and "Precision Editor". For each segment, you must provide:
1. viralScore: A score from 0-100 indicating viral potential.
2. newHookScript: A punchy 3-second script (written in ${outLang}) that the user can dub over the beginning of the video replacing the original intro to maximize retention.
3. retentionHacks: An array of 3 specific editing instructions (e.g. ['Add zoom', 'Split screen with Subway Surfers']) to keep Gen Z attention.
4. crop_x_center: ANALYZE THE VIDEO VISUALS. You must return a number from 0.0 to 1.0 indicating the horizontal center of the crop for 9:16 format (e.g., 0.5 is perfectly centered). Look for the main subject or face in the scene and set this parameter so they are centered in the vertical 9:16 slice!
5. zoom_points: A timeline of zoom effects. Array of { time, scale } where time is the timestamp relative to the original video and scale is the zoom factor (1.0 is default). Add zooms on key moments.
6. captions: A highly detailed array of { start, end, text } containing precise timestamps for each word or phrase spoken in the segment. Create at least 3-4 captions minimum if there is speech.`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [
          uploadResult,
          { text: prompt }
        ],
        config: {
          systemInstruction: "You are an expert video editor and social media manager. Return pure JSON array of segments.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                start: { type: Type.NUMBER },
                end: { type: Type.NUMBER },
                description: { type: Type.STRING },
                viralScore: { type: Type.NUMBER },
                newHookScript: { type: Type.STRING },
                retentionHacks: { type: Type.ARRAY, items: { type: Type.STRING } },
                crop_x_center: { type: Type.NUMBER },
                zoom_points: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: { time: { type: Type.NUMBER }, scale: { type: Type.NUMBER } },
                    required: ["time", "scale"]
                  }
                },
                captions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: { start: { type: Type.NUMBER }, end: { type: Type.NUMBER }, text: { type: Type.STRING } },
                    required: ["start", "end", "text"]
                  }
                }
              },
              required: ["title", "start", "end", "description", "viralScore", "newHookScript", "retentionHacks", "crop_x_center", "zoom_points", "captions"]
            }
          }
        }
      });
      
      const shortsText = aiResponse.text || "[]";
      let shorts;
      try {
        shorts = JSON.parse(shortsText);
      } catch (e) {
        throw new Error("Failed to parse AI response. " + shortsText);
      }

      // Cleanup
      fs.unlinkSync(tempPath);
      await ai.files.delete({ name: uploadResult.name });

      res.json({ ok: true, shorts });
    } catch (error) {
      console.error("Error processing video URL:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
