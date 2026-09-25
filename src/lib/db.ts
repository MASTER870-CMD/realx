import fs from 'fs';
import path from 'path';

const dataFile = path.join(process.cwd(), 'videos.json');

export function getVideos() {
  if (!fs.existsSync(dataFile)) {
    return [];
  }
  const data = fs.readFileSync(dataFile, 'utf-8');
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function saveVideo(video: any) {
  const videos = getVideos();
  // Recommendation logic: Simple randomize or sort by date
  // We'll just push to front
  videos.unshift(video);
  fs.writeFileSync(dataFile, JSON.stringify(videos, null, 2));
}
