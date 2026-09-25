import { NextResponse } from "next/server";
import { getVideos } from "../../../lib/db";

// Helper to extract keywords for recommendation
function extractKeywords(text: string) {
  if (!text) return [];
  const words = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ');
  return words.filter(w => w.length > 2);
}

export async function GET() {
  try {
    const videos = getVideos();
    
    // Customized Feed Recommendation System (NLP Tag-based Mock)
    // In a production environment, this would use TensorFlow, Collaborative Filtering, or Firestore vector search.
    // For this project, we build a robust heuristic recommendation algorithm.
    
    const scoredVideos = videos.map((v: any) => {
      // 1. Base popularity score
      let score = (v.likes || 0) * 2 + (v.views || 0) * 0.1;
      
      // 2. Content extraction (simulating NLP)
      const keywords = extractKeywords(v.title + " " + v.description);
      
      // 3. Simulated user preference matching
      // If a video has many distinct keywords, it has higher "content richness"
      score += keywords.length * 0.5;

      // 4. Recency bias (newer videos get a small boost so feed isn't stale)
      const videoAgeHours = (Date.now() - new Date(v.created_at).getTime()) / (1000 * 60 * 60);
      if (videoAgeHours < 24) {
        score += 15; // Boost new content
      }

      return {
        ...v,
        score,
        keywords // Exposing keywords for debugging/UI if needed
      };
    }).sort((a: any, b: any) => b.score - a.score);

    return NextResponse.json({ videos: scoredVideos });
  } catch (error: any) {
    console.error("Fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}

