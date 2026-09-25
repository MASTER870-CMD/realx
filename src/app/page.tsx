"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Upload, Heart, MessageCircle, Share2, Play, AlertCircle, LogIn, User, X, CheckCircle, Send, TrendingUp, Loader2, Search, ShieldAlert } from "lucide-react";
import { auth, googleProvider, db } from "../lib/firebase";
import { signInWithPopup, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, getDocs, increment } from "firebase/firestore";
import { useRouter } from "next/navigation";

// Simple Custom Toast System
function Toast({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4">
      <div className={`flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl text-sm font-semibold text-white ${type === 'success' ? 'bg-zinc-800' : 'bg-red-600'}`}>
        {type === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
        {type === 'error' && <AlertCircle className="w-5 h-5" />}
        {message}
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<any>(null);
  
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  
  // Background Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{total: number, current: number, currentFileName: string, progress: number}>({ total: 0, current: 0, currentFileName: "", progress: 0 });

  // Lazy Loading State
  const [visibleCount, setVisibleCount] = useState(3);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (node) {
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 3);
        }
      }, { rootMargin: "1500px" });
      observerRef.current.observe(node);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserData(userSnap.data());
          } else {
            const newUserData = {
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              email: currentUser.email,
              followers: [],
              following: [],
              creatorInteractions: {}
            };
            await setDoc(userRef, newUserData, { merge: true });
            setUserData(newUserData);
          }
        } catch (err) {
          console.error("Auth rule error:", err);
        }
      } else {
        setUserData(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setToast({ message: "Successfully logged in!", type: "success" });
    } catch (err: any) {
      setToast({ message: "Login failed: " + err.message, type: "error" });
    }
  };

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/videos");
      let localVideos = [];
      if (res.ok) {
        const apiData = await res.json();
        localVideos = apiData.videos || [];
      }

      let firestoreReels: any[] = [];
      try {
        const reelsSnap = await getDocs(collection(db, "reels"));
        firestoreReels = reelsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error("Could not fetch reels:", err);
      }
      
      const combined = [...localVideos, ...firestoreReels];
      const uniqueVideos = Array.from(new Map(combined.map(item => [item.id, item])).values());
      
      let statsMap = new Map();
      try {
        const statsSnap = await getDocs(collection(db, "video_stats"));
        statsSnap.docs.forEach(d => statsMap.set(d.id, d.data()));
      } catch (e) {
        console.log("Could not fetch stats for recommendation engine");
      }

      // PERSONALIZED ALGORITHM
      let personalAffinities: Record<string, number> = {};
      if (auth.currentUser) {
        try {
          const uSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
          if (uSnap.exists() && uSnap.data().creatorInteractions) {
             personalAffinities = uSnap.data().creatorInteractions;
          }
        } catch (e) {}
      }

      const videosWithScores = uniqueVideos.map(vid => {
        const stats = statsMap.get(vid.id);
        const likeCount = stats?.likes?.length || 0;
        const commentCount = stats?.comments?.length || 0;
        
        const ageInDays = (Date.now() - new Date(vid.created_at).getTime()) / (1000 * 60 * 60 * 24);
        const recencyBoost = Math.max(0, 10 - ageInDays);
        
        const globalEngagement = (likeCount * 2) + (commentCount * 4) + recencyBoost;
        
        // Personal boost: If I watched this creator a lot, boost their videos massively (e.g. affinity * 5)
        const personalBoost = (personalAffinities[vid.userId] || 0) * 5;
        
        const totalScore = globalEngagement + personalBoost;
        
        return {
          ...vid,
          score: totalScore,
          isPersonalized: personalBoost > 0
        };
      });

      videosWithScores.sort((a, b) => b.score - a.score);
      setVideos(videosWithScores);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [user]); // Re-fetch feed when user logs in so it can personalize!

  const uploadFileWithProgress = (file: File, fileCaption: string, onProgress: (pct: number) => void): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload", true);
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          onProgress(percentComplete);
        }
      };
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error("Upload failed"));
        }
      };
      
      xhr.onerror = () => reject(new Error("Network error"));

      const formData = new FormData();
      formData.append("file", file);
      const defaultTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      formData.append("title", fileCaption || defaultTitle);
      formData.append("description", fileCaption);
      
      xhr.send(formData);
    });
  };

  const startUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    setIsUploading(true);
    setShowUploadModal(false);
    setUploadQueue({ total: selectedFiles.length, current: 1, currentFileName: selectedFiles[0].name, progress: 0 });

    const filesToUpload = [...selectedFiles];
    const finalCaption = caption;
    setSelectedFiles([]);
    setCaption("");

    let successCount = 0;
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      setUploadQueue({ total: filesToUpload.length, current: i + 1, currentFileName: file.name, progress: 0 });
      
      try {
        const data = await uploadFileWithProgress(file, finalCaption, (pct) => {
          setUploadQueue(prev => ({ ...prev, progress: pct }));
        });

        if (data && data.video) {
           const reelRef = doc(db, "reels", data.video.id);
           await setDoc(reelRef, { 
             ...data.video, 
             userId: user?.uid,
             userDisplayName: userData?.displayName || user?.displayName || "Anonymous",
             userPhotoURL: userData?.photoURL || user?.photoURL || ""
           });
           await setDoc(doc(db, "video_stats", data.video.id), { likes: [], comments: [] });
           successCount++;
        }
      } catch (err: any) {
        console.error(`Error uploading ${file.name}:`, err);
      }
    }

    setIsUploading(false);
    setToast({ message: `Successfully shared ${successCount} post(s)!`, type: "success" });
    fetchVideos(); 
  };

  return (
    <>
    <style jsx global>{`
      .hide-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .hide-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `}</style>
    
    <div className="flex flex-col h-[100dvh] bg-black text-white font-sans overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="absolute top-0 w-full z-50 flex items-center justify-between px-4 py-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <h1 className="text-2xl font-bold tracking-tight pointer-events-auto shadow-black drop-shadow-lg">ReelX</h1>
        
        <div className="flex items-center gap-3 sm:gap-4 pointer-events-auto">
          <button 
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 p-2 bg-zinc-800/80 hover:bg-red-900/80 backdrop-blur-md rounded-full transition-all text-red-500"
          >
             <ShieldAlert className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => router.push('/search')}
            className="flex items-center gap-2 p-2 bg-zinc-800/80 hover:bg-zinc-700 backdrop-blur-md rounded-full transition-all"
          >
             <Search className="w-5 h-5" />
          </button>
          
          {user && (
            <button 
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 p-2 bg-zinc-800/80 hover:bg-zinc-700 backdrop-blur-md rounded-full transition-all"
            >
               <Upload className="w-5 h-5" />
            </button>
          )}

          {user ? (
            <button onClick={() => router.push('/profile')} className="flex items-center gap-2 p-2 bg-zinc-800/80 hover:bg-zinc-700 backdrop-blur-md rounded-full transition-all">
              <ProfileAvatar src={userData?.photoURL} size="small" />
            </button>
          ) : (
            <button onClick={handleLogin} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full transition-all">
              <LogIn className="w-4 h-4" />
              <span>Login</span>
            </button>
          )}
        </div>
      </header>

      {/* Custom Upload Modal */}
      {showUploadModal && (
        <div className="absolute inset-0 z-[150] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-xl">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-zinc-800">
              <button onClick={() => { setShowUploadModal(false); setSelectedFiles([]); setCaption(""); }}><X className="w-6 h-6" /></button>
              <h2 className="font-bold text-lg">New Post</h2>
              <button onClick={startUpload} className="text-blue-500 font-bold disabled:opacity-50" disabled={selectedFiles.length === 0}>Share</button>
            </div>
            
            <div className="p-4 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <ProfileAvatar src={userData?.photoURL} size="medium" />
                <textarea 
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a caption..."
                  className="w-full bg-transparent text-white outline-none resize-none h-24 placeholder:text-zinc-500"
                />
              </div>

              <div className="border border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center bg-zinc-800/30 gap-3">
                {selectedFiles.length > 0 ? (
                  <div className="text-center">
                    <div className="text-xl font-bold mb-1">{selectedFiles.length} videos selected in Queue</div>
                    <p className="text-xs text-zinc-400 truncate max-w-[200px]">{selectedFiles[0].name}</p>
                    <button onClick={() => setSelectedFiles([])} className="mt-3 text-red-500 text-sm font-semibold">Clear Queue</button>
                  </div>
                ) : (
                  <>
                    <div className="p-3 bg-zinc-800 rounded-full"><Upload className="w-6 h-6" /></div>
                    <span className="font-semibold text-sm">Select multiple videos (Queue Upload)</span>
                    <input 
                      type="file" 
                      accept="video/*" 
                      multiple 
                      className="hidden" 
                      id="upload-picker" 
                      onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                    />
                    <label htmlFor="upload-picker" className="px-4 py-2 bg-blue-600 rounded-lg font-semibold text-sm cursor-pointer mt-2 hover:bg-blue-700">Select from device</label>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Background Upload Manager */}
      {isUploading && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[140] flex flex-col items-center gap-2 bg-zinc-900/90 backdrop-blur-md p-4 rounded-2xl border border-zinc-700 shadow-2xl min-w-[300px]">
          <div className="flex justify-between w-full text-xs font-semibold text-zinc-300">
            <span className="flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
              Uploading... {uploadQueue.progress}%
            </span>
            <span>{uploadQueue.current} of {uploadQueue.total}</span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-200 ease-out" 
              style={{ width: `${uploadQueue.progress}%` }}
            />
          </div>
          <span className="text-xs text-zinc-400 truncate max-w-xs">{uploadQueue.currentFileName}</span>
        </div>
      )}

      <main className="flex-1 h-full w-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar relative bg-black">
        {loading && (
          <div className="h-full w-full flex flex-col items-center justify-center text-zinc-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p>Loading your personalized feed...</p>
          </div>
        )}

        {error && (
          <div className="h-full w-full flex items-center justify-center">
            <div className="flex flex-col items-center p-8 bg-zinc-900 rounded-2xl text-red-400 text-center">
              <AlertCircle className="w-12 h-12 mb-4" />
              <p className="font-semibold">Failed to load feed</p>
              <p className="text-sm mt-2 opacity-80">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && videos.length === 0 && (
          <div className="h-full w-full flex flex-col items-center justify-center text-zinc-500 text-center">
            <h2 className="text-xl font-medium text-zinc-300">No reels found</h2>
            <p className="mt-2 text-sm">Upload videos to prime the recommendation engine!</p>
          </div>
        )}

        {!loading && !error && videos.slice(0, visibleCount).map((video, idx) => (
          <VideoCard 
            key={video.id} 
            video={video} 
            user={user} 
            userData={userData} 
            setToast={setToast} 
            router={router} 
            isTopRecommended={idx === 0 && videos.length > 1}
          />
        ))}

        {/* Load More Trigger */}
        {visibleCount < videos.length && (
          <div ref={loadMoreRef} className="w-full h-1" />
        )}
      </main>
    </div>
    </>
  );
}

// Fallback Avatar Component
function ProfileAvatar({ src, size }: { src?: string, size: 'small' | 'medium' | 'large' }) {
  const [error, setError] = useState(false);
  const sizeClasses = {
    small: "w-6 h-6",
    medium: "w-10 h-10",
    large: "w-28 h-28 sm:w-36 sm:h-36"
  };

  if (!src || error) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-zinc-800 flex items-center justify-center border-zinc-700 ${size === 'large' ? 'border-4' : ''}`}>
        <User className={`text-zinc-400 ${size === 'large' ? 'w-12 h-12' : size === 'medium' ? 'w-5 h-5' : 'w-4 h-4'}`} />
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt="Profile" 
      onError={() => setError(true)}
      className={`${sizeClasses[size]} rounded-full object-cover border-zinc-800 ${size === 'large' ? 'border-4' : ''}`} 
    />
  );
}

function VideoCard({ video, user, userData, setToast, router, isTopRecommended }: { video: any, user: any, userData: any, setToast: any, router: any, isTopRecommended: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<any[]>([]);
  
  const [isFollowing, setIsFollowing] = useState(false);
  
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  
  const [creatorData, setCreatorData] = useState<any>(null);

  // STAGE 1 HYBRID WATCH TIME & COMPLETION RATE TRACKING
  const [watchSeconds, setWatchSeconds] = useState(0);
  const affinityRecorded = useRef(false);
  const loopBonusRecorded = useRef(false);

  // 1. Tick the watch timer when playing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && user && video.userId && user.uid !== video.userId) {
      interval = setInterval(() => {
        setWatchSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, user, video.userId]);

  // 2. Real-time evaluation! (No need to wait for swipe)
  useEffect(() => {
    if (watchSeconds > 0 && user && videoRef.current) {
       const duration = videoRef.current.duration;
       if (duration && video.userId && user.uid !== video.userId) {
          const completionRate = watchSeconds / duration;
          
          // First time they reach 80% completion -> +2 Creator points, +3 Video points
          if (completionRate > 0.8 && !affinityRecorded.current) {
             affinityRecorded.current = true;
             updateDoc(doc(db, "users", user.uid), {
               [`creatorInteractions.${video.userId}`]: increment(2),
               [`videoInteractions.${video.id}`]: increment(3)
             }).catch(()=>{});
          }
          
          // If they loop it multiple times (completion > 2.0) -> +3 MORE points!
          if (completionRate > 2.0 && !loopBonusRecorded.current) {
             loopBonusRecorded.current = true;
             updateDoc(doc(db, "users", user.uid), {
               [`creatorInteractions.${video.userId}`]: increment(3),
               [`videoInteractions.${video.id}`]: increment(5)
             }).catch(()=>{});
          }
       }
    }
  }, [watchSeconds, user, video.userId, video.id]);


  useEffect(() => {
    const fetchCreator = async () => {
      if (video.userId) {
        try {
          const userRef = doc(db, "users", video.userId);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data();
            setCreatorData(data);
            if (user && data.followers && data.followers.includes(user.uid)) {
               setIsFollowing(true);
            }
          }
        } catch (e) {
          console.log("Rules block read for user data");
        }
      }
    };
    fetchCreator();
  }, [video.userId, user]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const statsRef = doc(db, "video_stats", video.id);
        const snap = await getDoc(statsRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.likes) {
            setLikeCount(data.likes.length);
            if (user && data.likes.includes(user.uid)) {
              setLiked(true);
            }
          }
          if (data.comments) {
            setComments(data.comments);
          }
        } else {
          setLikeCount(0);
          setComments([]);
        }
      } catch (e) {
        console.log("Rules block read for video stats");
      }
    };
    fetchStats();
  }, [user, video.id]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  };
  
  const handleFollow = async () => {
    if (!user) return setToast({ message: "Please login to follow", type: "error" });
    if (!video.userId) return setToast({ message: "Cannot follow this account", type: "error" });
    if (user.uid === video.userId) return setToast({ message: "You cannot follow yourself", type: "error" });

    const targetUserRef = doc(db, "users", video.userId);
    const myRef = doc(db, "users", user.uid);

    setIsFollowing(!isFollowing);

    try {
      if (isFollowing) {
        await updateDoc(targetUserRef, { followers: arrayRemove(user.uid) });
        await updateDoc(myRef, { following: arrayRemove(video.userId) });
        setToast({ message: "Unfollowed", type: "success" });
      } else {
        await updateDoc(targetUserRef, { followers: arrayUnion(user.uid) });
        await updateDoc(myRef, { following: arrayUnion(video.userId) });
        setToast({ message: "Following!", type: "success" });
      }
    } catch (e: any) {
      setIsFollowing(isFollowing); // revert
      setToast({ message: "Database permissions denied", type: "error" });
    }
  };

  const toggleLike = async () => {
    if (!user) return setToast({ message: "Please login to like", type: "error" });
    const statsRef = doc(db, "video_stats", video.id);
    
    if (liked) {
      setLiked(false);
      setLikeCount((p: number) => p - 1);
      
      try {
        const snap = await getDoc(statsRef);
        if (snap.exists()) {
           await updateDoc(statsRef, { likes: arrayRemove(user.uid) });
        }
      } catch (e) {
        setLiked(true); setLikeCount((p: number) => p + 1);
      }
    } else {
      setLiked(true);
      setLikeCount((p: number) => p + 1);
      
      try {
        const snap = await getDoc(statsRef);
        if (!snap.exists()) {
          await setDoc(statsRef, { likes: [user.uid], comments: [] });
        } else {
          await updateDoc(statsRef, { likes: arrayUnion(user.uid) });
        }

        // Increase affinity massively if they liked it!
        if (video.userId && user.uid !== video.userId) {
          const myRef = doc(db, "users", user.uid);
          await updateDoc(myRef, { [`creatorInteractions.${video.userId}`]: increment(3), [`videoInteractions.${video.id}`]: increment(5) });
        }
      } catch (e) {
        setLiked(false); setLikeCount((p: number) => p - 1);
      }
    }
  };
  
  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return setToast({ message: "Please login to comment", type: "error" });
    if (!commentText.trim()) return;

    const newComment = {
      userId: user.uid,
      displayName: userData?.displayName || user.displayName || "Anonymous",
      photoURL: userData?.photoURL || user.photoURL || "",
      text: commentText,
      timestamp: Date.now()
    };

    setComments(prev => [...prev, newComment]);
    setCommentText("");

    try {
      const statsRef = doc(db, "video_stats", video.id);
      const snap = await getDoc(statsRef);
      if (!snap.exists()) {
        await setDoc(statsRef, { likes: [], comments: [newComment] });
      } else {
        await updateDoc(statsRef, { comments: arrayUnion(newComment) });
      }

      // Increase affinity massively if they commented!
      if (video.userId && user.uid !== video.userId) {
        const myRef = doc(db, "users", user.uid);
        await updateDoc(myRef, { [`creatorInteractions.${video.userId}`]: increment(5), [`videoInteractions.${video.id}`]: increment(10) });
      }
    } catch (e) {
      setToast({ message: "Permission Denied", type: "error" });
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && videoRef.current && !showComments) {
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        } else if (videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      },
      { threshold: 0.6 }
    );
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, [showComments]);

  const displayPhoto = creatorData?.photoURL || video.userPhotoURL;
  const displayName = creatorData?.displayName || video.userDisplayName;

  const navigateToProfile = () => {
    if (video.userId) {
      router.push(`/user/${video.userId}`);
    }
  };

  return (
    <div className="relative h-[100dvh] w-full snap-start snap-always flex justify-center bg-black">
      <div className="relative h-full w-full sm:max-w-md sm:h-[95vh] sm:rounded-2xl sm:my-auto overflow-hidden bg-black shadow-2xl">
        
        {isTopRecommended && (
          <div className="absolute top-4 left-4 z-10 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-white drop-shadow-md">
              {video.isPersonalized ? "Top Pick For You" : "Highly Recommended"}
            </span>
          </div>
        )}

        <video
          ref={videoRef}
          src={`${video.video_url}#t=0.1`}
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
          loop
          playsInline
          onClick={() => { if (!showComments) togglePlay(); }}
        />
        
        {!isPlaying && !showComments && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
              <Play className="w-8 h-8 ml-1 opacity-80" />
            </div>
          </div>
        )}

        <div className={`absolute bottom-0 left-0 right-16 p-4 pb-8 sm:pb-6 bg-gradient-to-t from-black/80 to-transparent pointer-events-none transition-opacity ${showComments ? 'opacity-0' : 'opacity-100'}`}>
          <div className="flex items-center gap-2 mb-3 pointer-events-auto">
            <div onClick={navigateToProfile} className="cursor-pointer hover:opacity-80 transition-opacity">
              {displayPhoto ? (
                 <ProfileAvatar src={displayPhoto} size="small" />
              ) : (
                 <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center border border-zinc-600">
                   <User className="w-4 h-4 text-zinc-400" />
                 </div>
              )}
            </div>
            
            <span onClick={navigateToProfile} className="font-semibold text-sm cursor-pointer hover:underline shadow-black drop-shadow-md">
               {displayName ? `@${displayName.replace(/\s+/g, '').toLowerCase()}` : `@creator_${video.id?.slice(-4)}`}
            </span>
            
            {(!user || user.uid !== video.userId) && (
              <button 
                onClick={handleFollow}
                className={`px-3 py-1 ml-2 text-xs font-semibold border border-white rounded-full transition-colors shadow-lg ${isFollowing ? 'bg-white text-black' : 'bg-transparent text-white hover:bg-white hover:text-black'}`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
          <p className="text-sm font-semibold text-white drop-shadow-md line-clamp-1 pointer-events-auto">
            {video.title}
          </p>
          {video.description && (
            <p className="text-xs text-zinc-300 mt-1 drop-shadow-md line-clamp-2 pointer-events-auto">
              {video.description}
            </p>
          )}
        </div>

        <div className={`absolute right-2 bottom-8 sm:bottom-6 flex flex-col gap-6 items-center transition-opacity ${showComments ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <button onClick={toggleLike} className="flex flex-col items-center gap-1">
            <div className={`p-3 rounded-full backdrop-blur-md shadow-lg ${liked ? 'bg-red-500/20' : 'bg-black/20'}`}>
              <Heart className={`w-7 h-7 transition-colors drop-shadow-lg ${liked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
            </div>
            <span className="text-xs font-bold drop-shadow-md">{likeCount}</span>
          </button>
          
          <button className="flex flex-col items-center gap-1" onClick={() => { setShowComments(true); if(videoRef.current) videoRef.current.pause(); setIsPlaying(false); }}>
            <div className="p-3 rounded-full bg-black/20 backdrop-blur-md shadow-lg">
              <MessageCircle className="w-7 h-7 text-white drop-shadow-lg" />
            </div>
            <span className="text-xs font-bold drop-shadow-md">{comments.length}</span>
          </button>

          <button className="flex flex-col items-center gap-1" onClick={() => setToast({message: "Link copied to clipboard!", type: "success"})}>
            <div className="p-3 rounded-full bg-black/20 backdrop-blur-md shadow-lg">
              <Share2 className="w-7 h-7 text-white drop-shadow-lg" />
            </div>
            <span className="text-xs font-bold drop-shadow-md">Share</span>
          </button>
        </div>

        {/* --- COMMENTS SLIDE-UP PANEL --- */}
        <div className={`absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-2xl transition-transform duration-300 ease-in-out ${showComments ? 'translate-y-0' : 'translate-y-full'} h-[60%] flex flex-col z-[100]`}>
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h3 className="font-bold text-lg">{comments.length} Comments</h3>
            <button onClick={() => { setShowComments(false); if(videoRef.current) videoRef.current.play(); setIsPlaying(true); }}><X className="w-6 h-6 text-zinc-400" /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {comments.length === 0 && (
              <div className="text-center text-zinc-500 mt-8 text-sm">
                No comments yet. Be the first!
              </div>
            )}
            {comments.map((c, i) => (
              <div key={i} className="flex gap-3">
                <ProfileAvatar src={c.photoURL} size="small" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-zinc-400">@{c.displayName?.replace(/\s+/g, '').toLowerCase() || "user"}</span>
                  <p className="text-sm text-white break-words">{c.text}</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleComment} className="p-4 border-t border-zinc-800 flex items-center gap-2 bg-zinc-900">
            {user ? <ProfileAvatar src={userData?.photoURL || user.photoURL} size="medium" /> : <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center"><User className="w-5 h-5" /></div>}
            <input 
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-zinc-800 rounded-full px-4 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 transition-colors"
            />
            <button type="submit" disabled={!commentText.trim()} className="p-2 text-blue-500 disabled:text-zinc-600 transition-colors">
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}





