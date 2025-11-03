# Quick Fix: Simplified TTS Service

## ✅ Problem Solved: SentencePiece Dependency Issue

The SpeechT5 model requires SentencePiece, which can be complex to install. I've created a simplified TTS service that works without complex dependencies.

## 🚀 Quick Installation

### Option 1: Minimal Installation (Recommended)
```bash
cd python-server
pip install soundfile numpy
python test_phase1_tts.py
```

### Option 2: Full Installation (If you want SpeechT5)
```bash
cd python-server
pip install -r requirements.txt
pip install sentencepiece
python test_phase1_tts.py
```

## 📁 What Changed

**New File: `simple_summary_tts.py`**
- Uses system TTS (Windows: PowerShell, macOS: `say`, Linux: `espeak`)
- Fallback to simple audio generation if system TTS unavailable
- Same email preprocessing and caching features
- No complex model dependencies

**Updated Test Script:**
- Now uses `SimpleEmailSummaryTTSService`
- Works without PyTorch/transformers
- Tests system TTS availability

## 🎯 Features Available

**With System TTS:**
- ✅ Real speech synthesis using your OS
- ✅ Professional pace adjustment
- ✅ Email text preprocessing
- ✅ Smart caching system
- ✅ Duration estimation

**Without System TTS:**
- ✅ Fallback audio generation
- ✅ All other features work
- ✅ Simple beep pattern based on text length

## 🧪 Test It Now

```bash
python test_phase1_tts.py
```

**Expected Output:**
```
🧪 Testing Email Summary TTS Service - Phase 1...
⚠️  PyTorch not available. Using simplified TTS service.

--- Test 1: Business meeting reminder ---
Original: Meeting scheduled for tomorrow at 3 PM...
Processed: Meeting scheduled for tomorrow at 3 PM...
Estimated duration: 8.6 seconds
Generating speech...
✅ Audio generated: 12345 bytes
✅ Audio cached successfully

🔧 Testing service initialization...
✅ Service initialized: Simple TTS
✅ System TTS available: True
✅ Professional tone: True
✅ Slow down factor: 0.9

🎉 All Phase 1 tests passed!
```

## 🔧 System TTS Requirements

**Windows:**
- PowerShell (built-in)
- System.Speech assembly

**macOS:**
- `say` command (built-in)

**Linux:**
- `espeak` package: `sudo apt install espeak`

## 📋 Next Steps

The simplified TTS service provides:
1. **Immediate functionality** without complex dependencies
2. **Same API** as the full service
3. **Easy upgrade path** to SpeechT5 later
4. **Cross-platform compatibility**

You can now proceed with Phase 2 (API endpoints) using this simplified service, and optionally upgrade to SpeechT5 later when you have time to resolve the SentencePiece dependency.
