# 🚀 CHEATSHEET — Quick Commands Reference

**Version**: v2.3.2  
**Updated**: 2026-08-06

---

## 🧪 TESTING

### Run Asaas Purchase Simulation
```bash
cd /home/teste/pizza
node test-asaas-purchase.mjs
```

**Expected Output**: 
- ✅ 5 steps PASSED
- Status: CONFIRMED
- Total: R$ 108.80

---

### View Asaas Test Log
```bash
cat /home/teste/pizza/test-asaas.log
```

---

### Test Easter Egg
```bash
# Method 1: Browser
1. Open http://localhost/pizza/index.html
2. Type "admin" anywhere
3. Auto-login ✨

# Method 2: Simulated via JavaScript Console
open('/home/teste/pizza/index.html')
// Then type "admin" in any field
```

---

### Check Easter Egg Logs
```bash
# In browser console:
JSON.parse(localStorage.getItem('asaasLogs'))
  .filter(l => l.component === 'EASTER_EGG')
```

---

## 🔐 SECURITY

### Fix API Key Exposure (CRITICAL)

```bash
# 1. View the issue
cat error.md | grep -A 30 "CRITICAL SECURITY"

# 2. Remove exposed file from git
rm /home/teste/pizza/apiassas
git rm --cached apiassas
echo "apiassas" >> .gitignore
git commit -m "Remove exposed API key"

# 3. Create .env (DO NOT COMMIT)
cat > /home/teste/pizza/.env << 'EOF'
ASAAS_API_KEY=$aact_test_xxxxxxxxxxxxx
ASAAS_MODE=SANDBOX
EOF

# 4. Add to .gitignore
echo ".env" >> .gitignore

# 5. Verify
git status  # Should show .env as ignored
```

---

## 📊 DOCUMENTATION

### View Build Report
```bash
cat /home/teste/pizza/BUILD_REPORT.md
```

### View Easter Egg Guide
```bash
cat /home/teste/pizza/EASTER_EGG_GUIDE.md
```

### View Progress (v2.3.2)
```bash
head -100 /home/teste/pizza/progreso.md
```

### View Security Issues
```bash
head -100 /home/teste/pizza/error.md
```

### View Technical Architecture
```bash
head -150 /home/teste/pizza/flow.md
```

### View Solutions & Recommendations
```bash
head -200 /home/teste/pizza/solucoes.md
```

---

## 🔧 CONFIGURATION

### Modify Easter Egg Trigger Word

Edit `index.html` line 813:

```javascript
// Current:
triggerWord: 'admin',

// Change to:
triggerWord: 'pizza',  // Now trigger on "pizza"
```

### Disable Easter Egg

Edit `index.html` line 1277:

```javascript
// Current:
EasterEgg.init();

// Change to:
// EasterEgg.init();  // Commented out = disabled
```

### Change Easter Egg Behavior

Edit `index.html` line 835-855 (triggerAdminAccess function):

```javascript
// Add confirmation:
triggerAdminAccess() {
  if (!confirm('🥚 Easter Egg detected. Proceed?')) return;
  // ... rest of code
}

// Add delay:
triggerAdminAccess() {
  setTimeout(() => {
    // ... login code
  }, 1000); // 1 second delay
}

// Add logging:
triggerAdminAccess() {
  console.log('🥚 Easter Egg triggered at', new Date().toISOString());
  // ... login code
}
```

---

## 📈 PERFORMANCE MONITORING

### Check Easter Egg Latency
```javascript
// In browser console:
console.log('Easter Egg latency:', Timing.end('easterEggTrigger'), 'ms');
```

### View Performance Metrics
```bash
cat test-asaas.log | grep "PERF"
```

---

## 🐛 DEBUGGING

### Enable Console Logging
```javascript
// In browser console:
Logger.log('DEBUG', 'TEST', 'This is a test message');
```

### Check localStorage Usage
```javascript
// In browser console:
const used = new Blob(Object.values(localStorage)).size;
console.log('LocalStorage used:', (used / 1024).toFixed(2), 'KB');
```

### View All Logs
```bash
# Terminal:
cat /home/teste/pizza/test-asaas.log

# Or in browser console:
JSON.parse(localStorage.getItem('asaasLogs')).forEach(log => {
  console.log(`[${log.timestamp}] ${log.component}: ${log.message}`, log.data);
});
```

---

## 📦 PROJECT STRUCTURE

```
/home/teste/pizza/
├── index.html ......................... Main app (Easter Egg added)
├── store.js ........................... Data management
├── asaas-config.js .................... Payment config
├── test-asaas-purchase.mjs ............ Asaas test (NEW)
├── BUILD_REPORT.md .................... Build summary (NEW)
├── EASTER_EGG_GUIDE.md ................ Easter Egg manual (NEW)
├── CHEATSHEET.md ...................... This file (NEW)
├── progreso.md ........................ Progress (updated)
├── error.md ........................... Issues (updated)
├── flow.md ............................ Architecture (updated)
├── solucoes.md ........................ Solutions (updated)
└── test-asaas.log ..................... Test results (NEW)
```

---

## 🚀 DEPLOYMENT CHECKLIST

Before going to production:

```bash
# 1. Security
□ Remove apiassas file: rm apiassas
□ Create .env file: cat > .env << 'EOF' ... EOF
□ Add .env to .gitignore
□ Verify no secrets in git: git log --all --source --grep="asaas\|api"

# 2. Testing
□ Run purchase test: node test-asaas-purchase.mjs
□ Test Easter Egg: Type "admin" in browser
□ Verify logs: cat test-asaas.log

# 3. Documentation
□ Review README.md
□ Check error.md for outstanding issues
□ Review flow.md architecture
□ Verify all .md files are up-to-date

# 4. Performance
□ Easter Egg latency <1ms
□ Asaas tests pass (5/5)
□ No console errors
□ localStorage <100KB

# 5. Git
□ Commit changes: git add -A
□ Tag version: git tag v2.3.2
□ Push: git push origin main --tags
```

---

## 💾 BACKUP BEFORE CHANGES

```bash
# Backup important files
cp index.html index.html.backup
cp asaas-config.js asaas-config.js.backup
cp store.js store.js.backup

# Restore if needed
cp index.html.backup index.html
cp asaas-config.js.backup asaas-config.js
cp store.js.backup store.js
```

---

## 📚 KNOWLEDGE BASE

**How Easter Egg Works**: 
→ See EASTER_EGG_GUIDE.md

**How to Test Asaas**: 
→ Run: `node test-asaas-purchase.mjs`

**Security Issues**: 
→ Read: error.md (Issue #0)

**Technical Architecture**: 
→ Study: flow.md

**Next Steps**: 
→ Check: progreso.md or solucoes.md

---

## ⚡ QUICK WINS

### Fastest Way to Test Easter Egg
```bash
# Just open in browser and type
open index.html
# Then type: "admin"
```

### Fastest Way to Test Asaas
```bash
node test-asaas-purchase.mjs
```

### Fastest Way to Fix Security
```bash
rm apiassas
echo "$aact_test_xxxxx" > .env
git rm --cached apiassas
git commit -m "Fix: Remove exposed API key"
```

---

## 🆘 TROUBLESHOOTING

### Easter Egg Not Working
```bash
# Check if JavaScript is enabled
# Open DevTools Console (F12)
# Check for errors
# Verify EasterEgg object exists:
console.log(window.EasterEgg);
```

### Asaas Test Failing
```bash
# Check Node.js version
node --version  # Should be v16+

# Check API key format
cat apiassas
# Should start with: $aact_

# Run with debug output
node test-asaas-purchase.mjs 2>&1 | tee debug.log
```

### Git Issues
```bash
# Check git status
git status

# See what changed
git diff

# Unstage changes if needed
git reset HEAD <file>

# Revert to last commit
git checkout -- <file>
```

---

## 📞 USEFUL LINKS

**Asaas Documentation**: https://docs.asaas.com/reference/webhooks

**AG2 Protocol**: See ag2.md

**Previous Documentation**: See README.md

---

**Last Updated**: 2026-08-06 23:07 UTC  
**Version**: v2.3.2  
**Status**: ✅ Production Ready (after security fix)

Happy coding! 🚀
