# Phase 1 Installation Guide - Fixed torchaudio Issue

## ✅ Fixed: torchaudio Dependency Issue

The `torchaudio` dependency has been made optional to avoid installation issues. The TTS service will work without it, just without professional tone adjustments.

## Installation Steps

### 1. Install Core Dependencies

```bash
cd python-server
pip install -r requirements.txt
```

### 2. Install PyTorch (if not already installed)

For CPU-only installation:
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
```

For GPU installation (if you have CUDA):
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### 3. Optional: Install torchaudio for Professional Tone

If you want professional tone adjustments (slightly slower speech):
```bash
pip install torchaudio
```

**Note**: The TTS service will work fine without torchaudio, just without the professional pace adjustment.

### 4. Set Up Environment

```bash
cp env-template.txt .env
# Edit .env and add your HF_TOKEN (optional for local models)
```

### 5. Test the Installation

```bash
python test_phase1_tts.py
```

## What Changed

**Requirements.txt Updates:**
- Removed specific torchaudio version requirement
- Made torch and transformers versions more flexible
- torchaudio is now optional

**TTS Service Updates:**
- Added optional torchaudio import
- Graceful fallback when torchaudio is not available
- Professional tone adjustments are skipped if torchaudio unavailable

**Test Script Updates:**
- Added PyTorch availability check
- Better error handling for missing dependencies

## Expected Behavior

**With torchaudio:**
- Full professional tone adjustments
- Slightly slower speech (0.9x speed) for better comprehension
- All features working

**Without torchaudio:**
- Basic TTS functionality works
- No professional tone adjustments
- Slightly faster speech (normal speed)
- All other features work normally

## Troubleshooting

**If you still get torchaudio errors:**
```bash
# Uninstall and reinstall torch
pip uninstall torch torchaudio
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

**If transformers installation fails:**
```bash
pip install transformers --no-deps
pip install tokenizers safetensors
```

**If you want to skip torchaudio entirely:**
The TTS service will work fine without it. You'll just get normal-speed speech instead of the professional pace adjustment.

## Test Results

The test script will now:
- ✅ Check PyTorch availability
- ✅ Test TTS service with or without torchaudio
- ✅ Show which features are available
- ✅ Provide clear error messages for missing dependencies

Run `python test_phase1_tts.py` to verify everything is working!
