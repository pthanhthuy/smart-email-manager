# Hugging Face TTS Installation Guide

## 🎯 Using Hugging Face TTS Models

You want to use the actual Hugging Face TTS models! Here's how to get them working properly.

## 📦 Installation Steps

### 1. Install Core Dependencies
```bash
cd python-server
pip install -r requirements.txt
```

### 2. Install SentencePiece (Required for SpeechT5)
```bash
pip install sentencepiece>=0.1.99
pip install protobuf>=3.20.0
```

### 3. Alternative: Install Everything at Once
```bash
pip install transformers torch sentencepiece protobuf soundfile
```

## 🔧 Troubleshooting SentencePiece

If you get SentencePiece errors, try these solutions:

### Option A: Install from Source
```bash
pip install sentencepiece --no-binary sentencepiece
```

### Option B: Use Conda (if you have it)
```bash
conda install -c conda-forge sentencepiece
```

### Option C: Install System Dependencies (Linux/macOS)
```bash
# Ubuntu/Debian
sudo apt-get install cmake build-essential

# macOS
brew install cmake

# Then reinstall sentencepiece
pip install sentencepiece --no-binary sentencepiece
```

## 🧪 Test Hugging Face TTS

```bash
python test_phase1_tts.py
```

**Expected Output:**
```
🧪 Testing Email Summary TTS Service - Phase 1...

--- Test 1: Business meeting reminder ---
Original: Meeting scheduled for tomorrow at 3 PM...
Processed: Meeting scheduled for tomorrow at 3 PM...
Estimated duration: 8.6 seconds
Generating speech...
✅ Audio generated: 12345 bytes
✅ Audio cached successfully

🔧 Testing model initialization...
✅ Model loaded: microsoft/speecht5_tts
✅ Professional tone: True
✅ Slow down factor: 0.9

🎉 All Phase 1 tests passed!
```

## 🎯 What You Get with Hugging Face TTS

**Microsoft SpeechT5 Features:**
- ✅ High-quality neural speech synthesis
- ✅ Professional business voice
- ✅ Multiple speaker options
- ✅ Natural pronunciation
- ✅ Professional pace adjustment (0.9x speed)
- ✅ Email-specific text preprocessing
- ✅ Smart caching system

**Model Specifications:**
- **Model**: Microsoft SpeechT5
- **Quality**: Neural TTS (much better than system TTS)
- **Languages**: English (primary)
- **Speakers**: Multiple professional voices
- **Audio**: 22050 Hz WAV format
- **Performance**: ~0.5-1 second generation time

## 🚀 Ready for Phase 2

Once Hugging Face TTS is working, you'll have:
1. **Professional-quality speech** for email summaries
2. **All Phase 1 features** working with neural models
3. **Ready for API endpoints** in Phase 2
4. **High-quality audio** for your email manager

## 📋 If You Still Have Issues

**Check Dependencies:**
```bash
python -c "import sentencepiece; print('✅ SentencePiece OK')"
python -c "import transformers; print('✅ Transformers OK')"
python -c "import torch; print('✅ PyTorch OK')"
```

**Test Model Loading:**
```bash
python -c "
from transformers import pipeline
model = pipeline('text-to-speech', model='microsoft/speecht5_tts')
print('✅ SpeechT5 loaded successfully')
"
```

**Common Issues:**
1. **SentencePiece not found**: Install with `pip install sentencepiece`
2. **Protobuf version conflict**: Install with `pip install protobuf>=3.20.0`
3. **CUDA issues**: Use CPU version with `device=-1`
4. **Memory issues**: Use smaller batch sizes

The Hugging Face TTS will give you much better quality than system TTS!
