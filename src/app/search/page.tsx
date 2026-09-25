"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Search as SearchIcon, User, ChevronRight } from "lucide-react";
import { db } from "../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function SearchPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const userList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(userList);
      } catch (err) {
        console.error("Failed to fetch users", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => {
    const name = u.displayName || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="min-h-[100dvh] bg-black text-white font-sans flex flex-col">
      <header className="sticky top-0 z-50 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 flex items-center bg-zinc-800 rounded-full px-4 py-2">
          <SearchIcon className="w-5 h-5 text-zinc-400 mr-2" />
          <input
            type="text"
            placeholder="Search creators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-white w-full text-sm"
            autoFocus
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center mt-10">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center text-zinc-500 mt-10">
            No users found
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredUsers.map(user => (
              <div 
                key={user.id}
                onClick={() => router.push(`/user/${user.id}`)}
                className="flex items-center justify-between bg-zinc-900/50 hover:bg-zinc-800 p-4 rounded-xl cursor-pointer transition-colors border border-zinc-800/50"
              >
                <div className="flex items-center gap-4">
                  {user.photoURL ? (
                    <img src={user.photoURL} className="w-12 h-12 rounded-full object-cover border border-zinc-700" alt="Profile" onError={(e) => { e.currentTarget.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(user?.displayName || "U") + "&background=3f3f46&color=fff"; }} />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                      <User className="w-6 h-6 text-zinc-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold">{user.displayName || "Anonymous Creator"}</h3>
                    <p className="text-xs text-zinc-400">
                      {user.followers?.length || 0} followers
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-500" />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}