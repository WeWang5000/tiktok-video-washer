#!/usr/bin/env python3
"""
TikTok Video Washer v2 - Clean, Fast, Simple
Uses stream copy for fast processing (2-10 seconds)
"""

from flask import Flask, request, jsonify, render_template, send_file
import os
import subprocess
import json
from datetime import datetime, timedelta
import random
from werkzeug.utils import secure_filename
import uuid
import sys
import time

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['WASHED_FOLDER'] = 'washed'

# Create directories
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['WASHED_FOLDER'], exist_ok=True)

ALLOWED_EXTENSIONS = {'mp4', 'mov', 'avi', 'mkv', 'webm', 'jpg', 'jpeg', 'png'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_metadata(filepath):
    """Extract metadata using exiftool"""
    try:
        result = subprocess.run(
            ['exiftool', '-j', filepath],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            metadata = json.loads(result.stdout)
            return metadata[0] if metadata else {}
    except Exception as e:
        print(f"Error extracting metadata: {e}", file=sys.stderr)
    return {}

def wash_video(input_path, output_path):
    """Wash video using fast stream copy - changes metadata only"""
    print(f"Washing video: {input_path} -> {output_path}", file=sys.stderr)
    
    if not os.path.exists(input_path):
        print(f"ERROR: Input file not found: {input_path}", file=sys.stderr)
        return False
    
    # Generate random recent date (1-30 days ago)
    now = datetime.now()
    days_ago = random.randint(1, 30)
    hours_ago = random.randint(1, 12)
    creation_date = now - timedelta(days=days_ago, hours=hours_ago)
    
    creation_time_str = creation_date.strftime("%Y-%m-%dT%H:%M:%S-0800")
    creation_date_str = creation_date.strftime("%Y:%m:%d %H:%M:%S")
    
    # FFmpeg command - STREAM COPY (fast!)
    cmd = [
        'ffmpeg', '-y', '-i', input_path,
        '-map_metadata', '-1',  # Remove all metadata
        '-movflags', 'use_metadata_tags',
        '-f', 'mp4',
        '-metadata', f'major_brand=qt',
        '-metadata', f'minor_version=0',
        '-metadata', f'compatible_brands=qt  ',
        '-metadata', f'encoder=Apple iPhone 15 Pro',
        '-metadata', f'creation_time={creation_time_str}',
        '-metadata:s:v:0', f'com.apple.quicktime.make=Apple',
        '-metadata:s:v:0', f'com.apple.quicktime.model=iPhone 15 Pro',
        '-metadata:s:v:0', f'com.apple.quicktime.software=iOS 17.0',
        '-metadata:s:v:0', f'com.apple.quicktime.creationdate={creation_time_str}',
        '-c:v', 'copy',  # Stream copy - FAST!
        '-c:a', 'copy',  # Stream copy - FAST!
        '-movflags', '+faststart',
        output_path
    ]
    
    print(f"Running FFmpeg (stream copy mode)...", file=sys.stderr)
    start_time = time.time()
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        elapsed = time.time() - start_time
        print(f"FFmpeg completed in {elapsed:.2f}s", file=sys.stderr)
        
        if result.returncode != 0:
            print(f"FFmpeg error: {result.stderr[:500]}", file=sys.stderr)
            return False
        
        if not os.path.exists(output_path):
            print(f"ERROR: Output file not created", file=sys.stderr)
            return False
        
        # Add metadata with ExifTool
        print(f"Adding metadata with ExifTool...", file=sys.stderr)
        exiftool_cmd = [
            'exiftool', '-overwrite_original',
            f'-CreateDate={creation_date_str}',
            f'-ModifyDate={creation_date_str}',
            f'-TrackCreateDate={creation_date_str}',
            f'-TrackModifyDate={creation_date_str}',
            f'-MediaCreateDate={creation_date_str}',
            f'-MediaModifyDate={creation_date_str}',
            f'-CreationTime={creation_time_str}',
            '-Make=Apple',
            '-Model=iPhone 15 Pro',
            '-Software=iOS 17.0',
            '-Artist=Apple',
            '-Title=iPhone 15 Pro',
            '-Comment=iOS 17.0',
            '-Encoder=Apple iPhone 15 Pro',
            output_path
        ]
        
        exiftool_result = subprocess.run(exiftool_cmd, capture_output=True, text=True, timeout=30)
        
        total_time = time.time() - start_time
        print(f"Video washing completed in {total_time:.2f}s", file=sys.stderr)
        return True
        
    except subprocess.TimeoutExpired:
        print(f"ERROR: FFmpeg timeout", file=sys.stderr)
        return False
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return False

def wash_image(input_path, output_path):
    """Wash image using ExifTool"""
    print(f"Washing image: {input_path} -> {output_path}", file=sys.stderr)
    
    if not os.path.exists(input_path):
        return False
    
    # Generate random recent date
    now = datetime.now()
    days_ago = random.randint(1, 30)
    hours_ago = random.randint(1, 12)
    creation_date = now - timedelta(days=days_ago, hours=hours_ago)
    creation_date_str = creation_date.strftime("%Y:%m:%d %H:%M:%S")
    creation_time_str = creation_date.strftime("%Y-%m-%dT%H:%M:%S-0800")
    
    # Copy file first
    import shutil
    shutil.copy2(input_path, output_path)
    
    # Add metadata
    exiftool_cmd = [
        'exiftool', '-overwrite_original',
        f'-CreateDate={creation_date_str}',
        f'-ModifyDate={creation_date_str}',
        f'-DateTimeOriginal={creation_date_str}',
        '-Make=Apple',
        '-Model=iPhone 15 Pro',
        '-Software=iOS 17.0',
        '-Artist=Apple',
        output_path
    ]
    
    try:
        result = subprocess.run(exiftool_cmd, capture_output=True, text=True, timeout=30)
        return result.returncode == 0
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400
    
    # Generate unique file ID
    file_id = str(uuid.uuid4())
    file_ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{file_id}.{file_ext}"
    upload_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    file.save(upload_path)
    file_size = os.path.getsize(upload_path)
    
    # Get metadata before
    metadata_before = get_metadata(upload_path)
    
    return jsonify({
        'file_id': file_id,
        'filename': filename,
        'file_ext': file_ext,
        'file_size': file_size,
        'metadata_before': metadata_before
    })

@app.route('/wash', methods=['POST'])
def wash():
    """Simple synchronous wash - fast stream copy"""
    start_time = time.time()
    
    try:
        data = request.json
        file_id = data.get('file_id')
        file_ext = data.get('file_ext')
        
        if not file_id or not file_ext:
            return jsonify({'error': 'Missing file_id or file_ext'}), 400
        
        upload_filename = f"{file_id}.{file_ext}"
        upload_path = os.path.join(app.config['UPLOAD_FOLDER'], upload_filename)
        
        if not os.path.exists(upload_path):
            return jsonify({'error': 'File not found'}), 404
        
        washed_filename = f"{file_id}_washed.{file_ext}"
        washed_path = os.path.join(app.config['WASHED_FOLDER'], washed_filename)
        
        # Wash the file
        if file_ext in ['jpg', 'jpeg', 'png']:
            success = wash_image(upload_path, washed_path)
        else:
            success = wash_video(upload_path, washed_path)
        
        if not success:
            return jsonify({'error': 'Failed to wash file'}), 500
        
        if not os.path.exists(washed_path):
            return jsonify({'error': 'Washed file was not created'}), 500
        
        # Get metadata after
        metadata_after = get_metadata(washed_path)
        file_size = os.path.getsize(washed_path)
        
        total_time = time.time() - start_time
        print(f"Total wash time: {total_time:.2f}s", file=sys.stderr)
        
        return jsonify({
            'success': True,
            'washed_filename': washed_filename,
            'file_size': file_size,
            'metadata_after': metadata_after
        })
        
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/download/<filename>')
def download_file(filename):
    file_path = os.path.join(app.config['WASHED_FOLDER'], filename)
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    return jsonify({'error': 'File not found'}), 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(debug=False, host='0.0.0.0', port=port)

