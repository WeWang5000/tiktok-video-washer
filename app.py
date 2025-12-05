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
print(f"App initialized - Upload folder: {app.config['UPLOAD_FOLDER']}, Washed folder: {app.config['WASHED_FOLDER']}", file=sys.stderr)

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
    upload_start = time.time()
    print(f"========================================", file=sys.stderr)
    print(f"UPLOAD START - {time.strftime('%Y-%m-%d %H:%M:%S')}", file=sys.stderr)
    print(f"Request method: {request.method}", file=sys.stderr)
    print(f"Content-Type: {request.content_type}", file=sys.stderr)
    print(f"Content-Length header: {request.headers.get('Content-Length', 'N/A')}", file=sys.stderr)
    
    try:
        # Check if file is in request
        if 'file' not in request.files:
            print(f"ERROR: No 'file' key in request.files", file=sys.stderr)
            print(f"Available keys: {list(request.files.keys())}", file=sys.stderr)
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        print(f"File object received: {file}", file=sys.stderr)
        print(f"File filename: {file.filename}", file=sys.stderr)
        
        if file.filename == '':
            print(f"ERROR: Empty filename", file=sys.stderr)
            return jsonify({'error': 'No file selected'}), 400
        
        # Check file extension
        if not allowed_file(file.filename):
            print(f"ERROR: File type not allowed: {file.filename}", file=sys.stderr)
            return jsonify({'error': 'File type not allowed'}), 400
        
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        file_ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{file_id}.{file_ext}"
        upload_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        print(f"File ID: {file_id}", file=sys.stderr)
        print(f"File extension: {file_ext}", file=sys.stderr)
        print(f"Upload path: {upload_path}", file=sys.stderr)
        
        # Check upload folder exists
        upload_folder = app.config['UPLOAD_FOLDER']
        if not os.path.exists(upload_folder):
            print(f"Creating upload folder: {upload_folder}", file=sys.stderr)
            os.makedirs(upload_folder, exist_ok=True)
        
        # Get file size from stream (if available)
        file.seek(0, 2)  # Seek to end
        file_size_from_stream = file.tell()
        file.seek(0)  # Reset to beginning
        print(f"File size from stream: {file_size_from_stream} bytes ({file_size_from_stream / 1024 / 1024:.2f} MB)", file=sys.stderr)
        
        # Save file
        print(f"Starting file save...", file=sys.stderr)
        save_start = time.time()
        try:
            file.save(upload_path)
            save_time = time.time() - save_start
            print(f"File save completed in {save_time:.2f}s", file=sys.stderr)
        except Exception as save_error:
            print(f"ERROR during file save: {save_error}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return jsonify({'error': f'Failed to save file: {str(save_error)}'}), 500
        
        # Verify file was saved
        if not os.path.exists(upload_path):
            print(f"ERROR: File not found after save: {upload_path}", file=sys.stderr)
            return jsonify({'error': 'File was not saved'}), 500
        
        file_size = os.path.getsize(upload_path)
        print(f"Saved file size: {file_size} bytes ({file_size / 1024 / 1024:.2f} MB)", file=sys.stderr)
        
        if file_size == 0:
            print(f"ERROR: Saved file is empty!", file=sys.stderr)
            return jsonify({'error': 'Uploaded file is empty'}), 400
        
        # Get metadata before
        print(f"Extracting metadata...", file=sys.stderr)
        metadata_start = time.time()
        metadata_before = get_metadata(upload_path)
        metadata_time = time.time() - metadata_start
        print(f"Metadata extraction completed in {metadata_time:.2f}s", file=sys.stderr)
        print(f"Metadata fields found: {len(metadata_before)}", file=sys.stderr)
        
        total_time = time.time() - upload_start
        print(f"UPLOAD SUCCESS - Total time: {total_time:.2f}s", file=sys.stderr)
        print(f"========================================", file=sys.stderr)
        
        return jsonify({
            'file_id': file_id,
            'filename': filename,
            'file_ext': file_ext,
            'file_size': file_size,
            'metadata_before': metadata_before
        })
        
    except Exception as e:
        total_time = time.time() - upload_start
        print(f"========================================", file=sys.stderr)
        print(f"UPLOAD ERROR after {total_time:.2f}s", file=sys.stderr)
        print(f"Error type: {type(e).__name__}", file=sys.stderr)
        print(f"Error message: {str(e)}", file=sys.stderr)
        import traceback
        print(f"Full traceback:", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        print(f"========================================", file=sys.stderr)
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

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
    print(f"Starting Flask app on port {port}", file=sys.stderr)
    print(f"Upload folder: {app.config['UPLOAD_FOLDER']}", file=sys.stderr)
    print(f"Washed folder: {app.config['WASHED_FOLDER']}", file=sys.stderr)
    print(f"Max content length: {app.config['MAX_CONTENT_LENGTH'] / 1024 / 1024} MB", file=sys.stderr)
    app.run(debug=False, host='0.0.0.0', port=port)

