"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { auth, db } from "../../lib/firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Camera, LogOut, ArrowLeft, Grid, Bookmark, Heart, MessageCircle, Trash2, User, Loader2 } from "lucide-react";
import Link from "next/link";

function ProfileAvatar({ src, size }: { src?: string, size: 'small' | 'medium' | 'large' }) {
  const [error, setError] = useState(false);
  const sizeClasses = {
    small: "w-6 h-6",
    medium: "w-10 h-10",
    large: "w-24 h-24 sm:w-32 sm:h-32"
  };

  if (!src || error) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-zinc-800 flex items-center justify-center border-zinc-700 ${size === 'large' ? 'border-4' : ''}`}>
        <User className={`text-zinc-500 ${size === 'large' ? 'w-12 h-12' : 'w-5 h-5'}`} />
      </div>
    );
  }
  return <img src={src} onError={() => setError(true)} className={`${sizeClasses[size]} rounded-full object-cover border-zinc-800 ${size === 'large' ? 'border-4' : ''}`} />;
}

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  const [myReels, setMyReels] = useState<any[]>([]);
  const [loadingReels, setLoadingReels] = useState(true);

  // Lazy Loading Grid
  const [visibleCount, setVisibleCount] = useState(12);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((prev) => prev + 12);
      }
    }, { rootMargin: "1500px" });
    
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) return router.push("/");
      setUser(currentUser);
      const userRef = doc(db, "users", currentUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        setUserData(snap.data());
        setName(snap.data().displayName || "");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const fetchMyReels = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, "reels"), where("userId", "==", user.uid));
        const snap = await getDocs(q);
        
        let statsMap = new Map();
        try {
          const statsSnap = await getDocs(collection(db, "video_stats"));
          statsSnap.docs.forEach(d => statsMap.set(d.id, d.data()));
        } catch(e) {}

        const fetched = snap.docs.map(d => {
          const data = d.data();
          const stats = statsMap.get(d.id) || { likes: [], comments: [] };
          return { id: d.id, ...data, likes: stats.likes?.length || 0, comments: stats.comments?.length || 0 };
        });
        fetched.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setMyReels(fetched);
      } catch (err) {
        console.error("Failed to load user reels", err);
      } finally {
        setLoadingReels(false);
      }
    };
    fetchMyReels();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const handleSave = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, { displayName: name }, { merge: true });
    setUserData({ ...userData, displayName: name });
    setIsEditing(false);
  };

  const handleDeleteReel = async (reelId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    try {
      await deleteDoc(doc(db, "reels", reelId));
      setMyReels(myReels.filter(r => r.id !== reelId));
    } catch (err) {
      alert("Failed to delete post");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload-image", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed to upload image");
      const data = await res.json();
      
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, { photoURL: data.url }, { merge: true });
      setUserData({ ...userData, photoURL: data.url });
    } catch (err) {
      alert("Failed to update profile picture");
    } finally {
      setIsUploading(false);
    }
  };

  if (!user || !userData) {
    return <div className="h-screen w-full bg-black flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>;
  }

  return (
    <div className="min-h-[100dvh] bg-black text-white p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl flex items-center mb-8">
        <Link href="/" className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-all mr-4">
          <ArrowLeft className="w-6 h-6 text-white" />
        </Link>
        <h1 className="text-xl font-bold font-sans flex-1 truncate">@{userData.displayName?.replace(/\s+/g, '').toLowerCase() || "user"}</h1>
      </div>

      <div className="w-full max-w-4xl">
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 mb-10">
          <div className="relative group flex-shrink-0">
            <ProfileAvatar src={userData?.photoURL} size="large" />
            <label className="absolute bottom-2 right-2 p-3 bg-blue-600 rounded-full cursor-pointer hover:bg-blue-700 transition-all shadow-lg">
              {isUploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Camera className="w-4 h-4 text-white" />}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
            </label>
          </div>

          <div className="flex flex-col items-center sm:items-start w-full">
            {isEditing ? (
              <div className="w-full flex items-center justify-center sm:justify-start gap-2 mb-4">
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="w-full max-w-[200px] px-4 py-2 bg-zinc-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  placeholder="Username"
                />
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 rounded-xl font-semibold hover:bg-blue-700">Save</button>
              </div>
            ) : (
              <div className="flex items-center gap-4 mb-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-white text-center sm:text-left">{userData?.displayName || "Anonymous User"}</h2>
                <button onClick={() => setIsEditing(true)} className="px-4 py-1.5 bg-zinc-800 rounded-lg text-sm font-semibold hover:bg-zinc-700 transition-all">
                  Edit Profile
                </button>
              </div>
            )}

            <div className="flex justify-center sm:justify-start gap-8 w-full mb-6 text-center sm:text-left">
              <div className="flex flex-col items-center sm:items-start">
                <span className="font-bold text-lg sm:text-xl">{myReels.length}</span>
                <span className="text-zinc-400 text-xs sm:text-sm">Posts</span>
              </div>
              <div className="flex flex-col items-center sm:items-start">
                <span className="font-bold text-lg sm:text-xl">{userData?.followers?.length || 0}</span>
                <span className="text-zinc-400 text-xs sm:text-sm">Followers</span>
              </div>
              <div className="flex flex-col items-center sm:items-start">
                <span className="font-bold text-lg sm:text-xl">{userData?.following?.length || 0}</span>
                <span className="text-zinc-400 text-xs sm:text-sm">Following</span>
              </div>
            </div>
            
            <button onClick={handleLogout} className="flex items-center justify-center gap-2 px-6 py-2 bg-red-600/20 text-red-500 border border-red-500/50 rounded-xl font-semibold hover:bg-red-600/30 transition-all w-full sm:w-auto">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>

        <div className="flex w-full border-t border-zinc-800 pt-4 mb-6">
          <div className="flex-1 flex justify-center items-center gap-2 text-white border-t-2 border-white -mt-[17px] pt-4 cursor-pointer">
            <Grid className="w-4 h-4" /> <span className="font-semibold text-xs sm:text-sm tracking-widest uppercase">Posts</span>
          </div>
          <div className="flex-1 flex justify-center items-center gap-2 text-zinc-500 pt-4 cursor-pointer">
            <Bookmark className="w-4 h-4" /> <span className="font-semibold text-xs sm:text-sm tracking-widest uppercase">Saved</span>
          </div>
        </div>

        {loadingReels ? (
          <div className="w-full flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-zinc-600 border-t-white rounded-full animate-spin" />
          </div>
        ) : myReels.length === 0 ? (
          <div className="w-full text-center py-20 text-zinc-500">
            <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-semibold">No Posts Yet</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1 sm:gap-4">
              {myReels.slice(0, visibleCount).map((reel) => (
                <div key={reel.id} className="relative aspect-[9/16] bg-zinc-800 group cursor-pointer overflow-hidden rounded-md sm:rounded-lg">
                  <video src={`${reel.video_url}#t=0.1`} preload="metadata" className="w-full h-full object-cover" muted />
                  
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                      <div className="flex items-center gap-1 font-bold text-xs sm:text-base"><Heart className="w-4 h-4 sm:w-5 sm:h-5 fill-white" /> {reel.likes || 0}</div>
                      <div className="flex items-center gap-1 font-bold text-xs sm:text-base"><MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 fill-white" /> {reel.comments || 0}</div>
                    </div>
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteReel(reel.id); }}
                      className="p-2 sm:p-3 bg-red-600 rounded-full hover:bg-red-700 text-white mt-2 transition-transform hover:scale-110 shadow-lg"
                      title="Delete Video"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {visibleCount < myReels.length && (
              <div ref={loadMoreRef} className="w-full h-1" />
            )}
          </>
        )}
      </div>
    </div>
  );
}



