# TikTok Video Washer v2

Clean, fast, simple video metadata washer for TikTok.

## Features

- ⚡ **Fast Processing**: Uses stream copy (2-10 seconds for most videos)
- 🎯 **Simple**: No polling, no complexity - just upload, wash, download
- 📱 **Mobile Responsive**: Works on all devices
- 🔒 **Privacy**: All processing happens server-side

## How It Works

1. Upload your video or photo
2. Click "Wash Video" (takes 2-10 seconds)
3. Download the washed file with fresh metadata

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
python app.py
```

Server will start on `http://localhost:8080`

## Deployment

### Railway

1. Connect your GitHub repo
2. Railway will auto-detect the Dockerfile
3. Deploy!

The app uses:
- **Port**: 5000 (Railway default)
- **Workers**: 1 (for file consistency)
- **Timeout**: 600 seconds (for large files)

## Requirements

- Python 3.11+
- FFmpeg
- ExifTool

All dependencies are included in the Dockerfile.

