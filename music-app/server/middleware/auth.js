// /middleware/auth.js - Authentication middleware
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticateUser = async (req, res, next) => {
  try {
    // Check for token in header or query parameter (for audio streaming)
    const token =
      req.headers.authorization?.replace("Bearer ", "") || req.query.token;

    if (!token) {
      return res.status(401).json({
        message: "Authentication required",
        authUrl: "/auth/google",
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user in database
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        message: "User not found or inactive",
        authUrl: "/auth/google",
      });
    }

    // --- FIX: THROTTLE lastActiveAt UPDATE (reduces DB writes) ---
    const FIVE_MINUTES = 5 * 60 * 1000;
    const now = new Date();

    // Check if the last active time is null or older than 5 minutes
    if (
      !user.lastActiveAt ||
      now.getTime() - new Date(user.lastActiveAt).getTime() > FIVE_MINUTES
    ) {
      // Use findByIdAndUpdate for an efficient, single-operation update
      await User.findByIdAndUpdate(user._id, { $set: { lastActiveAt: now } });
      // Update the in-memory user object for the rest of the request lifecycle
      user.lastActiveAt = now;
    }
    // --- END FIX ---

    // Attach user to request
    req.user = user;
    req.userId = user._id.toString();

    next();
  } catch (error) {
    console.error("❌ Authentication error:", error.message);
    return res.status(401).json({
      message: "Invalid token. Please re-authenticate.",
      authUrl: "/auth/google",
    });
  }
};

module.exports = { authenticateUser };
