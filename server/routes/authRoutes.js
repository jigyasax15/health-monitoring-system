const express = require("express");
const router = express.Router();
const { login, getMe, logout } = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");

// Authentication routes
router.post("/login", login);
router.post("/auth/login", login);

router.get("/auth/me", authenticate, getMe);
router.get("/me", authenticate, getMe);

router.post("/logout", logout);
router.post("/auth/logout", logout);

module.exports = router;
