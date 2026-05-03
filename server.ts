import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenAI, Type } from '@google/genai';
import ffmpeg from 'fluent-ffmpeg';
import youtubedl from 'youtube-dl-exec';

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
    // Get the best video url
    const directUrl = await youtubedl(url, {
      format: 'best[ext=mp4]/best',
      getUrl: true,
      noWarnings: true,
      extractorArgs: 'youtube:player_client=android'
    }).catch(err => {
      if (err.message && err.message.includes('Sign in to confirm')) {
        throw new Error('YouTube is blocking automated access from this IP (Bot Protection). Please run this locally or use cookies.');
      }
      throw err;
    });

    if (!directUrl) {
      throw new Error('No suitable video found.');
    }

    const videoStream = directUrl;
    const outputPath = path.join(rendersDir, `${renderId}.mp4`);

    // Create FFmpeg filters based on Blueprint
    const filters = [];
    
    // 1. Crop to 9:16 using crop_x_center
    const cx = short.crop_x_center !== undefined ? short.crop_x_center : 0.5;
    // We basically want to crop based on the input width and height.
    // 9:16 is width = height * 9/16.
    // X center is based on input width. 
    // filter: crop=w='ih*9/16':h='ih':x='(iw-ih*9/16)*${cx}':y=0
    filters.push(`crop=w='ih*9/16':h='ih':x='(iw-ih*9/16)*${cx}':y=0`);

    // 2. Zoom (simplified generic zoom using scale & crop if requested)
    if (short.zoom_points && short.zoom_points.length > 0) {
       const initialZoom = short.zoom_points[0].scale || 1.1;
       filters.push(`scale=iw*${initialZoom}:ih*${initialZoom}`);
       filters.push(`crop=w='iw/${initialZoom}':h='ih/${initialZoom}':x='(iw-iw/${initialZoom})/2':y='(ih-ih/${initialZoom})/2'`);
    }

    // 3. Captions (hardcoded into video using drawtext)
    // Fluent-ffmpeg drawtext on Windows/Linux requires fontfile, but we can use generic font if possible, or skip drawing if it breaks.
    // A reliable way to drawtext is to create a multi-filter chain, but drawtext path quoting is notoriously hard.
    // Let's rely on standard subtitles file OR just basic drawtext.
    // Due to environment font limitations, we'll try basic drawtext without specifying fontfile to use OS default.
    if (short.captions && short.captions.length > 0) {
       for (const cap of short.captions) {
          // Escape text for ffmpeg drawtext filter
          const escapedText = cap.text.replace(/'/g, '').replace(/:/g, '\\\\:'); 
          filters.push(`drawtext=text='${escapedText}':fontcolor=white:fontsize=48:x='(w-text_w)/2':y='h-150':enable='between(t,${cap.start - short.start},${cap.end - short.start})'`);
       }
    }

    ffmpeg()
      .input(videoStream)
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
    const { videoUrl, settings } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({ error: 'Missing videoUrl parameter' });
    }

    try {
      // Extract video ID from URL
      const improvedVideoIdMatch = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|shorts\/)([^"&?\/\s]{11})/i);
      
      let videoId = improvedVideoIdMatch ? improvedVideoIdMatch[1] : null;
      
      // Attempt to fetch transcript
      let transcriptText = "";
      if (videoId) {
        try {
          const transcript = await YoutubeTranscript.fetchTranscript(videoId);
          transcriptText = transcript.map(t => `[${t.offset / 1000}s]: ${t.text}`).join('\n');
        } catch (transcriptError) {
          // Fallback: Return empty transcript
        }
      }

      res.json({ ok: true, transcriptText, videoUrl });
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
