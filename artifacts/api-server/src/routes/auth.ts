import { Router } from "express";

declare module "express-session" {
  interface SessionData {
    userId: string;
    username: string;
    name: string;
  }
}

const router = Router();

const VALID_USERNAME = "mufondu";
const VALID_PASSWORD = "Mattywise*321#";
const USER_NAME = "Matthew Ufondu";

router.post("/auth/login", (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  if (username !== VALID_USERNAME || password !== VALID_PASSWORD) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  req.session.userId = "1";
  req.session.username = VALID_USERNAME;
  req.session.name = USER_NAME;

  req.session.save((err) => {
    if (err) {
      res.status(500).json({ error: "Session save failed" });
      return;
    }
    res.json({ user: { id: "1", username: VALID_USERNAME, name: USER_NAME } });
  });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/auth/me", (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ user: { id: req.session.userId, username: req.session.username, name: req.session.name } });
});

export default router;
