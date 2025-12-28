// Updated /pages.js - Home page with user support
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Container,
  Typography,
  Button,
  Box,
  CircularProgress,
  Card,
  CardContent,
  Fade,
  AppBar,
  Toolbar,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
} from "@mui/material";
import { motion } from "framer-motion";
import {
  Add as AddIcon,
  MusicNote as MusicNoteIcon,
  LibraryMusic as LibraryMusicIcon,
  Search as SearchIcon,
  Favorite as FavoriteIcon,
} from "@mui/icons-material";
import { useMusicStore } from "../lib/store";
import AddSongModal from "../components/AddSongModal";
import SongCard from "../components/SongCard";
import AuthButton from "../components/AuthButton";
import UserProfile from "../components/UserProfile";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import apiClient from "../lib/api";

const Home = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingSongs, setIsFetchingSongs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all"); // 'all', 'liked'

  const { songs, setSongs, setCurrentSong } = useMusicStore();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Use refs to avoid stale closures in event listeners
  const fetchSongsRef = useRef(null);
  const setSongsRef = useRef(setSongs);

  useEffect(() => {
    setSongsRef.current = setSongs;
  }, [setSongs]);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      // Show UI immediately, load songs in background
      setIsLoading(false);
      setIsFetchingSongs(true);
      fetchSongs();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [isAuthenticated, authLoading]);

  // Reopen Add Song modal when background toast dispatches the event
  useEffect(() => {
    const handleOpenAddSong = () => setIsModalOpen(true);
    window.addEventListener("open-add-song", handleOpenAddSong);
    return () => window.removeEventListener("open-add-song", handleOpenAddSong);
  }, []);

  const fetchSongs = useCallback(async () => {
    const startTime = performance.now();
    setIsFetchingSongs(true);

    try {
      const response = await apiClient.get("/api/songs");
      const serverSongs = Array.isArray(response.data) ? response.data : [];
      const optimisticSongs = songs.filter((song) => song.isOptimistic);

      // Merge server songs with optimistic songs, removing duplicates by uploadId
      const mergedSongs = [
        ...optimisticSongs.filter(
          (optimistic) =>
            !serverSongs.some(
              (server) => server.uploadId === optimistic.uploadId
            )
        ),
        ...serverSongs,
      ];

      setSongs(mergedSongs);
    } catch (error) {
      console.error("Failed to fetch songs:", error);
      if (error.response?.status !== 401) {
        // Don't show error for auth issues (handled by interceptor)
        toast.error("Failed to load songs");
      }
      if (songs.length === 0) {
        setSongs([]);
      }
    } finally {
      setIsFetchingSongs(false);
    }
  }, [songs, setSongs]);

  // Update ref when fetchSongs changes
  useEffect(() => {
    fetchSongsRef.current = fetchSongs;
  }, [fetchSongs]);

  const handleSongAdded = (newSong) => {
    // fetchSongs(); // Refresh to get accurate data from server
    toast.success(`"${newSong.videoTitle || newSong.name}" added!`);
  };
  const handleSongDeleted = useCallback((id, action) => {
    if (action === 'like') {
      handleToggleLike(id);
      return;
    }
    fetchSongs();
  }, [setSongs, fetchSongs]);

  const handleToggleLike = async (songId) => {
    // Optimistic update
    setSongs(prev => prev.map(song =>
      song.id === songId ? { ...song, liked: !song.liked } : song
    ));

    try {
      // API call would go here
      // await apiClient.post(`/api/songs/${songId}/like`);
      toast.success("Library updated");
    } catch (error) {
      // Revert on error
      setSongs(prev => prev.map(song =>
        song.id === songId ? { ...song, liked: !song.liked } : song
      ));
      toast.error("Failed to update like status");
    }
  };

  const filteredSongs = songs.filter(song => {
    const matchesSearch = (song.name || song.videoTitle || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (song.artist || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'liked' && song.liked);
    return matchesSearch && matchesFilter;
  });

  // Listen for upload completion to refresh song list
  useEffect(() => {
    // Use a Set to track which uploadIds we've already processed
    const processedUploads = new Set();

    const handleUploadComplete = async (event) => {
      const { uploadId, success, error } = event.detail;

      // Deduplicate: Skip if we've already processed this upload completion
      if (processedUploads.has(uploadId)) {
        console.log(
          "⚠️ Duplicate upload-complete event ignored for:",
          uploadId
        );
        return;
      }
      processedUploads.add(uploadId);

      console.log(
        "🎉 Processing upload-complete:",
        uploadId,
        success ? "SUCCESS" : "FAILED"
      );

      if (success) {
        // Use ref to get latest fetchSongs function
        if (fetchSongsRef.current) {
          await fetchSongsRef.current();
        }
        toast.success("Song upload completed!");
      } else {
        // Use ref to get latest setSongs function
        // FIXED: Only remove songs that have this specific uploadId (not null/undefined)
        if (setSongsRef.current && uploadId) {
          setSongsRef.current((prev) => {
            const filtered = prev.filter((song) => song.uploadId !== uploadId);
            console.log(
              `🗑️ Removed optimistic song with uploadId: ${uploadId}`
            );
            return filtered;
          });
        }

        // Show appropriate message
        if (error && error.includes("canceled")) {
          toast.error("Upload was canceled");
        } else {
          toast.error(`Upload failed: ${error || "Unknown error"}`);
        }
      }
    };

    window.addEventListener("upload-complete", handleUploadComplete);
    return () =>
      window.removeEventListener("upload-complete", handleUploadComplete);
  }, []); // Empty dependency array - listener only registers once

  const handleSongClick = (song, index) => setCurrentSong(song, index);

  // ...existing code...

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <Container
        maxWidth="sm"
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box textAlign="center">
          <CircularProgress size={60} thickness={4} sx={{ mb: 3 }} />
          <Typography variant="h6" color="text.secondary">
            Loading...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (!isAuthenticated) {
    return (
      <Container
        maxWidth="sm"
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Fade in timeout={800}>
          <Box textAlign="center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  margin: "0 auto 24px",
                  background:
                    "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 32px rgba(139, 92, 246, 0.3)",
                }}
              >
                <MusicNoteIcon sx={{ fontSize: 40, color: "white" }} />
              </Box>
            </motion.div>

            <Typography variant="h1" gutterBottom>
              Music Streaming App
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ mb: 4, maxWidth: 400 }}
            >
              Stream music from YouTube directly to your personal Google Drive.
              Sign in to get started.
            </Typography>

            <AuthButton />
          </Box>
        </Fade>
      </Container>
    );
  }

  return (
    <>
      {/* App Bar with User Profile */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background: "rgba(31, 41, 55, 0.8)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(139, 92, 246, 0.3)",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Box display="flex" alignItems="center" gap={2}>
            <MusicNoteIcon sx={{ color: "primary.main" }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Music Player
            </Typography>
          </Box>
          <UserProfile />
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* Header */}
        <Fade in timeout={600}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={4}
          >
            <Box>
              <Typography variant="h3" gutterBottom>
                {user?.name
                  ? `${user.name.split(" ")[0]}'s Music Library`
                  : "My Music Library"}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {filteredSongs.length} song{filteredSongs.length !== 1 ? "s" : ""}
                {filter === 'liked' ? " in favorites" : " in your personal collection"}
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              onClick={() => setIsModalOpen(true)}
              sx={{
                borderRadius: 3,
                px: 4,
                py: 1.5,
                fontSize: "1.1rem",
                minWidth: 160,
              }}
            >
              Add Song
            </Button>
          </Box>
        </Fade>

        {/* Search and Filter */}
        <Fade in timeout={800}>
          <Box mb={4}>
            <TextField
              fullWidth
              placeholder="Search your library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: 3,
                  background: "rgba(31, 41, 55, 0.6)",
                  backdropFilter: "blur(10px)",
                  "& fieldset": { border: "none" },
                }
              }}
              sx={{ mb: 3 }}
            />

            <Tabs
              value={filter}
              onChange={(_, val) => setFilter(val)}
              textColor="secondary"
              indicatorColor="secondary"
              sx={{
                "& .MuiTab-root": {
                  textTransform: "none",
                  fontSize: "1rem",
                  fontWeight: 600,
                  minWidth: 100
                }
              }}
            >
              <Tab label="All Songs" value="all" />
              <Tab label="Liked" value="liked" icon={<FavoriteIcon fontSize="small" />} iconPosition="start" />
            </Tabs>
          </Box>
        </Fade>

        {/* Song List */}
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress size={60} thickness={4} />
          </Box>
        ) : isFetchingSongs && (!Array.isArray(songs) || songs.length === 0) ? (
          <Box display="flex" justifyContent="center" py={8}>
            <Box textAlign="center">
              <CircularProgress size={60} thickness={4} sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Loading your music library...
              </Typography>
            </Box>
          </Box>
        ) : !Array.isArray(songs) || songs.length === 0 ? (
          <Fade in timeout={800}>
            <Card
              sx={{
                textAlign: "center",
                py: 8,
                px: 4,
                background:
                  "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                border: "2px dashed rgba(139, 92, 246, 0.3)",
              }}
            >
              <CardContent>
                <LibraryMusicIcon
                  sx={{ fontSize: 80, color: "text.secondary", mb: 2 }}
                />
                <Typography variant="h4" gutterBottom>
                  No songs yet
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ mb: 4 }}
                >
                  Add your first song from YouTube to your personal library
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={() => setIsModalOpen(true)}
                >
                  Add Your First Song
                </Button>
              </CardContent>
            </Card>
          </Fade>
        ) : (
          <Fade in timeout={1000}>
            <Box display="flex" flexDirection="column" gap={2}>
              {filteredSongs.map((song, index) => (
                <SongCard
                  key={song.id}
                  song={song}
                  index={index}
                  totalSongs={filteredSongs.length}
                  onClick={() => handleSongClick(song, index)}
                  onSongDeleted={handleSongDeleted}
                />
              ))}
            </Box>
          </Fade>
        )}

        {/* Add Song Modal */}
        <AddSongModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSongAdded={handleSongAdded}
          fetchSongsFromDrive={fetchSongs}
        />
      </Container>
    </>
  );
};

export default Home;
