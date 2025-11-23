import React from "react";
import {
    Card,
    Box,
    Typography,
    IconButton,
    Tooltip,
    useTheme,
    alpha,
} from "@mui/material";
import {
    PlayArrow as PlayIcon,
    Delete as DeleteIcon,
    AccessTime as TimeIcon,
    MusicNote as MusicIcon,
    Favorite as FavoriteIcon,
    FavoriteBorder as FavoriteBorderIcon,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import apiClient from "../lib/api";
import toast from "react-hot-toast";

const SongCard = ({ song, index, totalSongs, onClick, onSongDeleted }) => {
    const theme = useTheme();

    const handleDelete = async (e) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to delete "${song.name}"?`)) {
            return;
        }

        try {
            await apiClient.delete(`/api/songs/${song.id}`);
            toast.success("Song deleted successfully");
            if (onSongDeleted) {
                onSongDeleted(song.id);
            }
        } catch (error) {
            console.error("Error deleting song:", error);
            toast.error("Failed to delete song");
        }
    };

    // Format duration if available (assuming seconds)
    const formatDuration = (seconds) => {
        if (!seconds) return "--:--";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
        >
            <Card
                onClick={onClick}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    p: 2,
                    cursor: "pointer",
                    background: alpha(theme.palette.background.paper, 0.6),
                    backdropFilter: "blur(10px)",
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                    borderRadius: 3,
                    transition: "all 0.2s ease-in-out",
                    "&:hover": {
                        background: alpha(theme.palette.background.paper, 0.8),
                        borderColor: theme.palette.primary.main,
                        boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
                        "& .play-icon": {
                            opacity: 1,
                            transform: "scale(1)",
                        },
                        "& .song-index": {
                            opacity: 0,
                            display: "none",
                        },
                    },
                }}
            >
                {/* Index / Play Icon */}
                <Box
                    sx={{
                        width: 40,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        mr: 2,
                    }}
                >
                    <Typography
                        className="song-index"
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontWeight: 600 }}
                    >
                        {index + 1}
                    </Typography>
                    <IconButton
                        className="play-icon"
                        size="small"
                        sx={{
                            opacity: 0,
                            transform: "scale(0.8)",
                            transition: "all 0.2s",
                            position: "absolute",
                            color: theme.palette.primary.main,
                        }}
                    >
                        <PlayIcon />
                    </IconButton>
                </Box>

                {/* Thumbnail */}
                <Box
                    sx={{
                        width: 60,
                        height: 60,
                        borderRadius: 2,
                        overflow: "hidden",
                        mr: 3,
                        position: "relative",
                        flexShrink: 0,
                        backgroundColor: "action.hover",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {song.thumbnail ? (
                        <img
                            src={song.thumbnail}
                            alt={song.name}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                            }}
                        />
                    ) : (
                        <MusicIcon color="disabled" />
                    )}
                </Box>

                {/* Song Info */}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography
                        variant="subtitle1"
                        noWrap
                        sx={{ fontWeight: 600, mb: 0.5 }}
                    >
                        {song.name || song.videoTitle || "Unknown Title"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                        {song.artist || "Unknown Artist"}
                    </Typography>
                </Box>

                {/* Duration */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        color: "text.secondary",
                        mx: 3,
                        display: { xs: "none", sm: "flex" },
                    }}
                >
                    <TimeIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    <Typography variant="body2">
                        {formatDuration(song.duration)}
                    </Typography>
                </Box>

                {/* Actions */}
                <Box display="flex" alignItems="center" gap={1}>
                    <Tooltip title={song.liked ? "Unlike" : "Like"}>
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onSongDeleted && song.toggleLike) song.toggleLike();
                                if (onSongDeleted) onSongDeleted(song.id, 'like');
                            }}
                            sx={{
                                color: song.liked ? "secondary.main" : "text.secondary",
                                "&:hover": {
                                    color: "secondary.main",
                                    background: alpha(theme.palette.secondary.main, 0.1),
                                },
                            }}
                        >
                            {song.liked ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Delete Song">
                        <IconButton
                            size="small"
                            onClick={handleDelete}
                            sx={{
                                color: "text.secondary",
                                "&:hover": {
                                    color: "error.main",
                                    background: alpha(theme.palette.error.main, 0.1),
                                },
                            }}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Card>
        </motion.div>
    );
};

export default SongCard;
