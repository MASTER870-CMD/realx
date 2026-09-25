"use client";

import { useState, useEffect, useRef, use, useCallback } from "react";
import { ArrowLeft, User, Heart, MessageCircle, Loader2 } from "lucide-react";
import { db, auth } from "../../../lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function UserProfile({ params }: { params: Promise<{ userId: string }> }) {
  const unwrappedParams = use(params);
  const targetUserId = unwrappedParams.userId;
  const router = useRouter();
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [userData, setUserData] = useState<any>(null);
  const [userVideos, setUserVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  
  // Lazy Loading Grid
  const [visibleCount, setVisibleCount] = useState(12);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (node) {
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 12);
        }
      }, { rootMargin: "1500px" });
      observerRef.current.observe(node);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      try {
        // Fetch target user data
        const userRef = doc(db, "users", targetUserId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserData(data);
          if (currentUser && data.followers?.includes(currentUser.uid)) {
            setIsFollowing(true);
          }
        }

        // Fetch their videos
        const q = query(collection(db, "reels"), where("userId", "==", targetUserId));
        const videosSnap = await getDocs(q);
        
        // Fetch stats for these videos
        const statsSnap = await getDocs(collection(db, "video_stats"));
        const statsMap = new Map();
        statsSnap.docs.forEach(d => statsMap.set(d.id, d.data()));

        const videos = videosSnap.docs.map(doc => {
          const data = doc.data();
          const stats = statsMap.get(doc.id) || { likes: [], comments: [] };
          return {
            id: doc.id,
            ...data,
            likeCount: stats.likes?.length || 0,
            commentCount: stats.comments?.length || 0
          };
        });
        
        // Sort by newest
        videos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setUserVideos(videos);

      } catch (err) {
        console.error("Failed to load user profile", err);
      } finally {
        setLoading(false);
      }
    };
    
    if (targetUserId) {
      fetchUserData();
    }
  }, [targetUserId, currentUser]);

  const handleFollow = async () => {
    if (!currentUser) return alert("Please login to follow");
    if (currentUser.uid === targetUserId) return;

    const targetRef = doc(db, "users", targetUserId);
    const myRef = doc(db, "users", currentUser.uid);

    setIsFollowing(!isFollowing);

    try {
      if (isFollowing) {
        await updateDoc(targetRef, { followers: arrayRemove(currentUser.uid) });
        await updateDoc(myRef, { following: arrayRemove(targetUserId) });
        setUserData((prev: any) => ({ ...prev, followers: prev.followers.filter((id: string) => id !== currentUser.uid) }));
      } else {
        await updateDoc(targetRef, { followers: arrayUnion(currentUser.uid) });
        await updateDoc(myRef, { following: arrayUnion(targetUserId) });
        setUserData((prev: any) => ({ ...prev, followers: [...(prev.followers || []), currentUser.uid] }));
      }
    } catch (e) {
      setIsFollowing(isFollowing);
      alert("Permission denied");
    }
  };

  if (loading) {
    return <div className="h-screen w-full bg-black flex items-center justify-center text-white"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="min-h-[100dvh] bg-black text-white font-sans">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md p-4 flex items-center gap-4 border-b border-zinc-800">
        <button onClick={() => router.back()} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold truncate">{userData?.displayName || 'User Profile'}</h1>
      </header>

      <main className="max-w-4xl mx-auto pb-10">
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6 sm:p-10">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-zinc-800 border-2 border-zinc-700 flex-shrink-0">
            {userData?.photoURL ? (
              <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><User className="w-12 h-12 text-zinc-500" /></div>
            )}
          </div>
          
          <div className="flex flex-col items-center sm:items-start gap-4 flex-1 w-full">
            <div className="text-center sm:text-left">
              <h2 className="text-2xl font-bold">{userData?.displayName || 'Anonymous Creator'}</h2>
              <p className="text-zinc-400">@{userData?.displayName?.replace(/\s+/g, '').toLowerCase() || 'creator'}</p>
            </div>
            
            <div className="flex justify-center sm:justify-start gap-6 w-full text-center">
              <div>
                <span className="block font-bold text-lg">{userVideos.length}</span>
                <span className="text-xs text-zinc-400">Posts</span>
              </div>
              <div>
                <span className="block font-bold text-lg">{userData?.followers?.length || 0}</span>
                <span className="text-xs text-zinc-400">Followers</span>
              </div>
              <div>
                <span className="block font-bold text-lg">{userData?.following?.length || 0}</span>
                <span className="text-xs text-zinc-400">Following</span>
              </div>
            </div>

            {(!currentUser || currentUser.uid !== targetUserId) && (
              <button 
                onClick={handleFollow}
                className={`w-full sm:w-auto px-8 py-2 rounded-full font-bold transition-all ${isFollowing ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        </div>

        {/* Video Grid */}
        <div className="border-t border-zinc-800 mt-4">
          <div className="grid grid-cols-3 gap-1 sm:gap-2 pt-1 sm:pt-2">
            {userVideos.length === 0 && (
              <div className="col-span-3 text-center py-20 text-zinc-500">
                This user hasn't posted any reels yet.
              </div>
            )}
            
            {userVideos.slice(0, visibleCount).map((video) => (
              <div key={video.id} className="relative aspect-[9/16] bg-zinc-900 group cursor-pointer overflow-hidden rounded-md sm:rounded-lg">
                <video 
                  src={`${video.video_url}#t=0.1`} 
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                  preload="metadata"
                />
                
                {/* Stats overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-1 font-bold text-xs sm:text-base">
                    <Heart className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
                    <span>{video.likeCount}</span>
                  </div>
                  <div className="flex items-center gap-1 font-bold text-xs sm:text-base">
                    <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
                    <span>{video.commentCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {visibleCount < userVideos.length && (
             <div ref={loadMoreRef} className="w-full h-1" />
          )}
        </div>
      </main>
    </div>
  );
}



