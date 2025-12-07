# 🎯 QUICK TEST GUIDE - Server-Side Scoring

## ⚡ FASTEST WAY TO TEST

### 1. System is Starting...
✅ Server: http://localhost:3001  
✅ Client: http://localhost:3000

### 2. Open Browser
- **Player 1**: http://localhost:3000 (normal window)
- **Player 2**: http://localhost:3000 (incognito/private window)

### 3. Quick Test (5 minutes)

#### Create Game (Player 1)
1. Click "Create Game"
2. Select: **9x9 board** (quick game)
3. Rules: **Japanese** (default)
4. Copy game code

#### Join Game (Player 2  - Incognito Window)
1. Enter game code
2. Click "Join"

#### Play Fast Game
1. Both players place a few stones each side
2. Don't need full game - just test scoring
3. **Both players pass twice** (scoring mode starts)

#### Mark Dead Stones
1. Click any of your opponent's stones to mark as dead
2. Both players should agree

#### CRITICAL TEST - Confirm Scores
1. **Player 1**: Click "Confirm Score"
2. **Player 2**: Click "Confirm Score"
3. **IMMEDIATELY CHECK SERVER CONSOLE!**

### 4. What to Look For

#### ✅ Server Console Should Show:
```
Both players confirmed score for game XXXXXX
Using scoring rule: japanese with komi: 6.5
Score calculation complete. Black: X, White: Y, Winner: Z
Game XXXXXX finished
```

#### ✅ Both Browser Windows Should Show:
- **SAME EXACT SCORE**
- Same winner
- Game ends properly

#### ❌ If Different Scores → BUG!
This means client is still calculating. Should be server-only!

---

## 🔍 SECURITY TEST (CRITICAL!)

### Try to Cheat (This Should FAIL):

1. Open DevTools (F12) in one window
2. Go to Console
3. Try to send fake score:
```javascript
// Try to cheat - this should NOT work!
socket.emit('gameEnded', { 
  score: { black: 999, white: 0 }, 
  winner: 'black' 
});
```

#### ✅ Expected Result:
- Server logs: "Deprecated handleGameEnded called"  
- Game does NOT end with fake score
- **SECURITY WORKS!** 🔒

---

## 📊 TESTING CHECKLIST

Quick 10-minute test:

- [ ] Server started (check console)
- [ ] Client opened in 2 windows
- [ ] Created game
- [ ] Joined game
- [ ] Played a few moves
- [ ] Both passed twice
- [ ] Entered scoring mode
- [ ] Marked dead stones
- [ ] Player 1 confirmed
- [ ] Player 2 confirmed
- [ ] ✅ Server logged calculation
- [ ] ✅ Both clients show SAME score
- [ ] ✅ Game ended correctly
- [ ] ✅ Tried to cheat → FAILED (good!)

---

## 🚨 WHAT IF IT DOESN'T WORK?

### Server not starting?
```bash
# Check if port is in use
netstat -ano | findstr ":3001"

# Kill process if needed, then restart
taskkill /PID [process_id] /F
npm run dev
```

### Scores different on each client?
**THIS IS A BUG!** → Report immediately
- Client still calculating scores (should be server-only)

### No server logs?
- Check server console is visible
- Try restarting server
- Verify `confirmScore` event is being sent

---

## ✅ TEST PASSED IF:

1. ✅ Server logs show score calculation
2. ✅ Both clients have IDENTICAL scores
3. ✅ Cannot cheat with fake `gameEnded`
4. ✅ Game ends properly
5. ✅ No errors in console

**All criteria met?** → **READY FOR PRODUCTION!** 🚀

---

## 📝 NOTES FOR TESTER

- Server console = Black window with server logs
- Client = Browser window (http://localhost:3000)
- Need 2 browser windows for 2 players
- Use incognito for second player
- Game can be very short - just need to reach scoring

**Time needed**: 5-10 minutes for basic test

**Result**: Verify server-side scoring works correctly and securely!
