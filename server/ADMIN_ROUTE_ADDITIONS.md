# Additions to your admin routes (statsAdmin.js or wherever ban/unban/verify/gift live)

## 1. Add imports near the top

```js
const notify = require("../utils/notify");
const { notifyAdmins } = require("../utils/notify");
```

## 2. Ban route — add after the ban succeeds

```js
router.post("/players/:id/ban", protect, adminOnly, async (req, res) => {
  try {
    const { reason, durationDays } = req.body;
    const banUntil = durationDays
      ? new Date(Date.now() + durationDays * 86400000)
      : null;
    const player = await Player.findByIdAndUpdate(
      req.params.id,
      {
        isBanned: true,
        banReason: reason,
        banUntil,
      },
      { new: true },
    );

    await AuditLog.create({
      adminId: req.player._id,
      adminName: req.player.username,
      action: "player.ban",
      target: player.username,
      details: { reason, durationDays },
    });

    // ADD THIS — notify the banned player (email:true, this is important):
    const io = req.app.get("io");
    notify(io, player._id, {
      type: "admin_banned",
      title: "Account Banned",
      message: durationDays
        ? `Your account was banned for ${durationDays} day(s). Reason: ${reason}`
        : `Your account was permanently banned. Reason: ${reason}`,
      icon: "🚫",
      meta: { reason, durationDays },
      email: true,
    }).catch(() => {});

    res.json({ message: "Player banned", player });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

## 3. Unban route — add after the unban succeeds

```js
router.post("/players/:id/unban", protect, adminOnly, async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(
      req.params.id,
      {
        isBanned: false,
        banReason: null,
        banUntil: null,
      },
      { new: true },
    );

    await AuditLog.create({
      adminId: req.player._id,
      adminName: req.player.username,
      action: "player.unban",
      target: player.username,
    });

    // ADD THIS:
    const io = req.app.get("io");
    notify(io, player._id, {
      type: "admin_unbanned",
      title: "Account Unbanned",
      message: "Your account ban has been lifted. Welcome back!",
      icon: "✅",
      email: true,
    }).catch(() => {});

    res.json({ message: "Player unbanned", player });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

## 4. Verify/unverify toggle route — add after the update succeeds

```js
router.patch("/players/:id", protect, adminOnly, async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    // ADD THIS (only if isVerified was part of the update):
    if (req.body.isVerified !== undefined) {
      const io = req.app.get("io");
      notify(io, player._id, {
        type: req.body.isVerified ? "admin_verified" : "admin_unverified",
        title: req.body.isVerified
          ? "Account Verified"
          : "Verification Removed",
        message: req.body.isVerified
          ? "Your account has been verified! You now have access to verified perks."
          : "Your verified status has been removed by an admin.",
        icon: req.body.isVerified ? "✓" : "⚠️",
      }).catch(() => {});
    }

    res.json({ player });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

## 5. Gift subscription route — add after the gift succeeds

```js
router.post(
  "/players/:id/subscription",
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const { plan, durationDays } = req.body;
      const expiresAt = new Date(Date.now() + durationDays * 86400000);
      const player = await Player.findByIdAndUpdate(
        req.params.id,
        {
          "subscription.plan": plan,
          "subscription.status": "active",
          "subscription.expiresAt": expiresAt,
        },
        { new: true },
      );

      await AuditLog.create({
        adminId: req.player._id,
        adminName: req.player.username,
        action: "player.giftSubscription",
        target: player.username,
        details: { plan, durationDays },
      });

      // ADD THIS (email:true, this is a nice thing to email about):
      const io = req.app.get("io");
      notify(io, player._id, {
        type: "admin_gifted_subscription",
        title: `🎁 You received ${plan.toUpperCase()}!`,
        message: `An admin gifted you ${plan.toUpperCase()} for ${durationDays} days. Enjoy the extra perks!`,
        icon: "🎁",
        meta: { plan, durationDays },
        email: true,
      }).catch(() => {});

      res.json({ message: "Subscription gifted", player });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);
```

## 6. Optional: notify other admins on any admin action (activity feed)

If you want a live feed for admins (as discussed), add this generic call after
EVERY admin action route above, right after the `AuditLog.create(...)` line:

```js
notifyAdmins(req.app.get("io"), {
  title: "Admin action taken",
  message: `${req.player.username} performed: ${action} on ${target}`,
  icon: "🛠️",
}).catch(() => {});
```

Replace `action` and `target` with the actual values from that route (e.g. `'player.ban'`, `player.username`).
This creates a notification for every OTHER online admin, so they see what's happening in real time.
