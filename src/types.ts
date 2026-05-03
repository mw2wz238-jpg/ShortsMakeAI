export interface Short {
  title: string;
  start: number;
  end: number;
  description: string;
  viralScore?: number;
  newHookScript?: string;
  retentionHacks?: string[];
  crop_x_center?: number;
  zoom_points?: { time: number; scale: number }[];
  captions?: { start: number; end: number; text: string }[];
  captionColor?: string;
  captionStyle?: string;
  watermark?: string | null;
  filter?: string;
  renderStatus?: 'idle' | 'rendering' | 'finished' | 'error';
  renderProgress?: number;
  finalVideoUrl?: string;
}

export interface JobSettings {
  targetPlatform: 'tiktok' | 'youtube_shorts' | 'reels';
  durationLimit: 'under_60s' | 'under_30s' | 'any';
  focus: 'humor' | 'educational' | 'engaging_hook' | 'any';
  outputLanguage?: string;
}

export interface Job {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  shorts?: Short[];
  error?: string;
  settings?: JobSettings;
  createdAt: number;
  updatedAt: number;
  userId: string;
}
