import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { YoutubeTranscript } from 'youtube-transcript';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Backend API to fetch transcript due to CORS restrictions
  app.post('/api/functions/get-transcript', async (req, res) => {
    const { videoUrl } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({ error: 'Missing videoUrl parameter' });
    }

    try {
      // Extract video ID from URL
      const videoIdMatch = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|shorts\/)([^"&?\/\s]{11})/);
      if (!videoIdMatch) {
         throw new Error("Invalid YouTube URL");
      }
      const videoId = videoIdMatch[1];
      
      // Attempt to fetch transcript
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      const transcriptText = transcript.map(t => `[${t.offset / 1000}s]: ${t.text}`).join('\\n');

      res.json({ ok: true, transcriptText });
    } catch (error) {
      console.error("Error fetching transcript:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
