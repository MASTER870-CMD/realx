"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, TrendingUp, Users, PlaySquare, Heart, ShieldAlert, BarChart3, MoreHorizontal, Activity, MessageCircle } from "lucide-react";
import { db } from "../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Lazy Loading States
  const [visibleVideos, setVisibleVideos] = useState(12);
  const [visibleUsers, setVisibleUsers] = useState(20);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const loadMoreVideosRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (node) {
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) setVisibleVideos(prev => prev + 12);
      }, { rootMargin: "500px" });
      observerRef.current.observe(node);
    }
  }, []);

  const loadMoreUsersRef = useCallback((node: HTMLTableRowElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (node) {
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) setVisibleUsers(prev => prev + 20);
      }, { rootMargin: "500px" });
      observerRef.current.observe(node);
    }
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const uSnap = await getDocs(collection(db, "users"));
        const userList = uSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        userList.sort((a, b) => (b.followers?.length || 0) - (a.followers?.length || 0));
        setUsers(userList);

        const rSnap = await getDocs(collection(db, "reels"));
        const sSnap = await getDocs(collection(db, "video_stats"));
        
        const statsMap = new Map();
        sSnap.docs.forEach(d => statsMap.set(d.id, d.data()));

        const videoList = rSnap.docs.map(doc => {
          const vData = doc.data();
          const stats = statsMap.get(doc.id) || { likes: [], comments: [] };
          return {
            id: doc.id,
            ...vData,
            likeCount: stats.likes?.length || 0,
            commentCount: stats.comments?.length || 0,
            score: (stats.likes?.length || 0) * 2 + (stats.comments?.length || 0) * 4
          };
        });
        
        videoList.sort((a, b) => b.score - a.score);
        setVideos(videoList);
      } catch (err) {
        console.error("Failed to load admin data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  const totalLikes = videos.reduce((acc, curr) => acc + curr.likeCount, 0);
  const totalComments = videos.reduce((acc, curr) => acc + curr.commentCount, 0);

  return (
    <div className="min-h-[100dvh] bg-[#09090b] text-zinc-100 font-sans flex flex-col relative overflow-hidden">
      
      {/* Premium Ambient Background Glow */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-rose-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Floating Header */}
      <header className="sticky top-0 z-50 p-4 sm:p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')} className="p-3 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-full transition-all">
            <ArrowLeft className="w-5 h-5 text-zinc-300" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <img src="/logo.jpg" alt="ReelX Logo" className="w-7 h-7 rounded-md object-cover shadow-[0_0_10px_rgba(255,165,0,0.4)]" /> ReelX Control Center
            </h1>
            <p className="text-sm text-zinc-500 font-medium">System Analytics & Management</p>
          </div>
        </div>
      </header>

      {/* Pill Navigation */}
      <div className="px-4 sm:px-6 mb-8 mt-2 relative z-10">
        <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 overflow-x-auto max-w-full hide-scrollbar">
          {[
            { id: 'overview', icon: Activity, label: 'Overview' },
            { id: 'trending', icon: TrendingUp, label: 'Trending' },
            { id: 'users', icon: Users, label: 'Database' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setVisibleVideos(12); setVisibleUsers(20); }} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
                activeTab === tab.id 
                ? 'bg-white/10 text-white shadow-lg border border-white/10' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-indigo-400' : ''}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 pb-24 relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[50vh]">
            <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
            <p className="text-zinc-500 font-medium tracking-wide">Syncing data...</p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Total Accounts", value: users.length, icon: Users, color: "text-blue-400", bg: "bg-blue-400/10" },
                  { label: "Active Reels", value: videos.length, icon: PlaySquare, color: "text-purple-400", bg: "bg-purple-400/10" },
                  { label: "Total Likes", value: totalLikes, icon: Heart, color: "text-rose-400", bg: "bg-rose-400/10" },
                  { label: "Comments", value: totalComments, icon: BarChart3, color: "text-emerald-400", bg: "bg-emerald-400/10" },
                ].map((stat, i) => (
                  <div key={i} className="bg-white/5 border border-white/5 backdrop-blur-sm p-8 rounded-3xl flex flex-col relative overflow-hidden group hover:border-white/10 transition-colors">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700" />
                    <div className={`p-4 rounded-2xl ${stat.bg} w-max mb-6`}>
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    <span className="text-4xl font-bold tracking-tight text-white mb-2">{stat.value.toLocaleString()}</span>
                    <span className="text-sm font-medium text-zinc-400 tracking-wide">{stat.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* TRENDING VIDEOS TAB */}
            {activeTab === 'trending' && (
              <div className="flex flex-col gap-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {videos.slice(0, visibleVideos).map((vid, idx) => (
                    <div key={vid.id} className="group relative aspect-[9/16] bg-zinc-900 rounded-3xl overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1 cursor-pointer">
                      <img 
                        src={vid.video_url ? vid.video_url.replace(/\.[^/.]+$/, ".jpg") : ""} 
                        loading="lazy" 
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                        alt="Thumbnail" 
                      />
                      
                      {/* Ranking Badge */}
                      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 z-10">
                        <span className="text-xs font-bold text-white tracking-widest">#{idx + 1}</span>
                      </div>

                      {/* Gradient Overlay & Stats */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-5">
                        <h3 className="font-bold text-sm text-white line-clamp-2 mb-1 leading-snug drop-shadow-md">{vid.title || "Untitled Reel"}</h3>
                        <div className="text-xs text-zinc-300 font-medium mb-4 flex items-center gap-2">
                           <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center">
                             <span className="text-[10px] text-indigo-200">@</span>
                           </div>
                           <span className="truncate">{vid.userDisplayName?.toLowerCase() || "creator"}</span>
                        </div><div className="flex items-center gap-4 text-xs font-semibold text-white/90">
                          <div className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-rose-400" /> {vid.likeCount}</div>
                          <div className="flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-blue-400" /> {vid.commentCount}</div>
                          <div className="flex items-center gap-1.5 ml-auto text-indigo-300"><TrendingUp className="w-3.5 h-3.5" /> {vid.score}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {visibleVideos < videos.length && (
                  <div ref={loadMoreVideosRef} className="py-10 flex justify-center">
                    <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                  </div>
                )}
              </div>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
              <div className="bg-white/5 border border-white/5 backdrop-blur-xl rounded-3xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-white/10 text-zinc-400 font-medium tracking-wide">
                        <th className="px-6 py-5">Creator</th>
                        <th className="px-6 py-5">Audience</th>
                        <th className="px-6 py-5">Following</th>
                        <th className="px-6 py-5">Contact</th>
                        <th className="px-6 py-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {users.sort((a,b) => (a.displayName || "").localeCompare(b.displayName || "")).slice(0, visibleUsers).map((u, idx) => {
                        const isLast = idx === Math.min(visibleUsers, users.length) - 1;
                        return (
                          <tr key={u.id} ref={isLast ? loadMoreUsersRef : null} className="hover:bg-white/5 transition-colors group">
                            <td className="px-6 py-4 flex items-center gap-4">
                              {u.photoURL ? (
                                <img src={u.photoURL} className="w-10 h-10 rounded-full object-cover border border-white/10" alt="profile" onError={(e) => { e.currentTarget.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(u?.displayName || "U") + "&background=3f3f46&color=fff"; }} />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold border border-indigo-500/30">
                                  {(u.displayName || "A").charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="font-bold text-white text-base">{u.displayName || "Anonymous"}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                                <Users className="w-3.5 h-3.5" />
                                {u.followers?.length || 0}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-semibold text-zinc-300">{u.following?.length || 0}</td>
                            <td className="px-6 py-4 text-zinc-500">{u.email || "Hidden"}</td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => router.push(`/user/${u.id}`)} 
                                className="inline-flex items-center justify-center bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all border border-white/5 opacity-0 group-hover:opacity-100 focus:opacity-100"
                              >
                                View Profile
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {visibleUsers < users.length && (
                  <div className="py-6 flex justify-center border-t border-white/5">
                     <div className="text-sm font-medium text-zinc-500">Scroll for more...</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

