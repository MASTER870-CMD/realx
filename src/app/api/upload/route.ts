import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { saveVideo } from "../../../lib/db";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string || "Untitled";
    const description = formData.get("description") as string || "";

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary using a stream
    const cloudinaryResult: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: "reelx_videos",
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            reject(error);
          }
          else resolve(result);
        }
      );
      
      uploadStream.end(buffer);
    });

    // Save video metadata locally
    const newVideo = {
      id: Date.now().toString(),
      title,
      description,
      video_url: cloudinaryResult.secure_url,
      public_id: cloudinaryResult.public_id,
      created_at: new Date().toISOString(),
      likes: Math.floor(Math.random() * 100), // Mock data for recommendation
      views: Math.floor(Math.random() * 1000)
    };

    saveVideo(newVideo);

    return NextResponse.json({ success: true, video: newVideo });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Video upload failed", details: error.message },
      { status: 500 }
    );
  }
}

