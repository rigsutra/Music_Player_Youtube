import { create } from 'zustand';

export const useMusicStore = create((set, get) => ({
  // Audio state
  currentSong: null,
  isPlaying: false,
  duration: 0,
  currentTime: 0,
  volume: 1,
  isMuted: false,
  
  // UI state
  isPlayerVisible: false,
  isLoading: false,
  
  // Songs list
  songs: [],
  currentIndex: -1,
  
  // Actions
  setCurrentSong: (song, index = -1) => {
    set({ 
      currentSong: song, 
      currentIndex: index,
      isPlayerVisible: true,
      isLoading: true
    });
  },
  
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  
  setDuration: (duration) => set({ duration }),
  
  setCurrentTime: (time) => set({ currentTime: time }),
  
  setVolume: (volume) => set({ volume }),
  
  setMuted: (muted) => set({ isMuted: muted }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setSongs: (songs) => set({ songs }),
  
  playNext: () => {
    const { songs, currentIndex } = get();
    if (songs.length === 0) return;
    
    const nextIndex = currentIndex < songs.length - 1 ? currentIndex + 1 : 0;
    const nextSong = songs[nextIndex];
    
    set({ 
      currentSong: nextSong, 
      currentIndex: nextIndex,
      isLoading: true
    });
  },
  
  playPrevious: () => {
    const { songs, currentIndex } = get();
    if (songs.length === 0) return;
    
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : songs.length - 1;
    const prevSong = songs[prevIndex];
    
    set({ 
      currentSong: prevSong, 
      currentIndex: prevIndex,
      isLoading: true
    });
  },
  
  togglePlayPause: () => {
    set((state) => ({ isPlaying: !state.isPlaying }));
  },
  
  seekTo: (time) => {
    set({ currentTime: time });
  },
  
  reset: () => {
    set({
      currentSong: null,
      isPlaying: false,
      duration: 0,
      currentTime: 0,
      currentIndex: -1,
      isPlayerVisible: false,
      isLoading: false
    });
  }
}));