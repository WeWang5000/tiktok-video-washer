let currentFileId = null;
let currentFileExt = null;
let washedFilename = null;

const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const successBanner = document.getElementById('successBanner');
const washBtn = document.getElementById('washBtn');
const downloadBtn = document.getElementById('downloadBtn');
const metadataComparison = document.getElementById('metadataComparison');
const metadataBefore = document.getElementById('metadataBefore');
const metadataAfter = document.getElementById('metadataAfter');
const uploadIcon = document.getElementById('uploadIcon');
const uploadText = document.getElementById('uploadText');
const uploadLoading = document.getElementById('uploadLoading');
const uploadProgress = document.getElementById('uploadProgress');
const washLoading = document.getElementById('washLoading');

// Upload box click
uploadBox.addEventListener('click', () => fileInput.click());

// File input change
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Drag and drop
uploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadBox.classList.add('dragover');
});

uploadBox.addEventListener('dragleave', () => {
    uploadBox.classList.remove('dragover');
});

uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

async function handleFile(file) {
    // Check file size (500MB max)
    if (file.size > 500 * 1024 * 1024) {
        alert('File size exceeds 500MB limit');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    // Show loading indicator immediately
    showUploadLoading();
    
    // Force UI update
    if (uploadLoading) {
        uploadLoading.style.display = 'flex';
        uploadLoading.style.visibility = 'visible';
        uploadLoading.style.opacity = '1';
        uploadLoading.offsetHeight; // Force reflow
    }
    
    await new Promise(resolve => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    });

    const uploadStartTime = Date.now();

    try {
        washBtn.style.display = 'none';
        downloadBtn.style.display = 'none';
        metadataComparison.style.display = 'none';
        successBanner.style.display = 'none';

        // Use XMLHttpRequest for progress tracking
        const data = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    if (uploadProgress) {
                        uploadProgress.textContent = percentComplete + '%';
                    }
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        resolve(data);
                    } catch (e) {
                        reject(new Error('Failed to parse response'));
                    }
                } else {
                    try {
                        const error = JSON.parse(xhr.responseText);
                        reject(new Error(error.error || 'Upload failed'));
                    } catch (e) {
                        reject(new Error('Upload failed'));
                    }
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Network error during upload'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Upload cancelled'));
            });

            xhr.open('POST', '/upload');
            xhr.send(formData);
        });
        
        currentFileId = data.file_id;
        currentFileExt = data.file_ext || file.name.split('.').pop().toLowerCase();
        
        if (!currentFileId || currentFileId === 'undefined' || currentFileId === 'null') {
            alert('Error: Invalid file ID received from server');
            return;
        }

        // Hide loading indicator
        hideUploadLoading();

        // Display file info
        fileName.textContent = data.filename;
        fileSize.textContent = formatFileSize(data.file_size);
        fileInfo.style.display = 'block';

        // Display metadata before
        displayMetadata(data.metadata_before, metadataBefore);
        metadataComparison.style.display = 'block';

        // Show wash button
        washBtn.style.display = 'flex';
        washBtn.disabled = false;

    } catch (error) {
        hideUploadLoading();
        alert('Error: ' + error.message);
    }
}

function showUploadLoading() {
    if (uploadIcon) {
        uploadIcon.style.display = 'none';
        uploadIcon.style.visibility = 'hidden';
    }
    
    if (uploadText) {
        uploadText.style.display = 'none';
        uploadText.style.visibility = 'hidden';
    }
    
    if (uploadLoading) {
        uploadLoading.style.display = 'flex';
        uploadLoading.style.visibility = 'visible';
        uploadLoading.style.opacity = '1';
        uploadLoading.style.position = 'relative';
        uploadLoading.style.zIndex = '10';
        uploadLoading.classList.remove('hidden');
        uploadLoading.removeAttribute('hidden');
    }
    
    if (uploadBox) {
        uploadBox.classList.add('uploading');
        uploadBox.style.pointerEvents = 'none';
    }
    
    if (uploadProgress) {
        uploadProgress.textContent = '0%';
    }
}

function hideUploadLoading() {
    if (uploadIcon) uploadIcon.style.display = 'block';
    if (uploadText) uploadText.style.display = 'block';
    if (uploadLoading) uploadLoading.style.display = 'none';
    if (uploadBox) uploadBox.classList.remove('uploading');
}

washBtn.addEventListener('click', async () => {
    if (!currentFileId || !currentFileExt) {
        alert('Error: File information missing. Please upload the file again.');
        return;
    }

    washBtn.disabled = true;
    washBtn.innerHTML = '<span class="spinner" style="width: 20px; height: 20px; border-width: 2px; display: inline-block; margin-right: 8px; vertical-align: middle;"></span> Washing...';
    
    // Show visible loading indicator
    if (washLoading) {
        washLoading.style.display = 'flex';
    }

    try {
        const startTime = Date.now();
        
        const response = await fetch('/wash', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file_id: currentFileId,
                file_ext: currentFileExt
            })
        });
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`Wash completed in ${elapsed}s`);

        if (!response.ok) {
            let error;
            try {
                error = await response.json();
            } catch (e) {
                error = { error: `HTTP ${response.status}: ${response.statusText}` };
            }
            throw new Error(error.error || 'Washing failed');
        }

        const data = await response.json();
        
        // Hide loading indicator
        if (washLoading) {
            washLoading.style.display = 'none';
        }
        
        washedFilename = data.washed_filename;

        // Display metadata after
        displayMetadata(data.metadata_after, metadataAfter);

        // Update file size
        fileSize.textContent = formatFileSize(data.file_size);

        // Show success banner
        successBanner.style.display = 'flex';

        // Show download button
        downloadBtn.style.display = 'flex';
        downloadBtn.disabled = false;

        washBtn.innerHTML = '<span class="btn-icon">🚀</span> Wash Video';
        washBtn.disabled = true;

    } catch (error) {
        console.error('Wash error:', error);
        
        // Hide loading indicator on error
        if (washLoading) {
            washLoading.style.display = 'none';
        }
        
        alert('Error: ' + error.message);
        washBtn.innerHTML = '<span class="btn-icon">🚀</span> Wash Video';
        washBtn.disabled = false;
    }
});

downloadBtn.addEventListener('click', () => {
    if (washedFilename) {
        window.location.href = `/download/${washedFilename}`;
    }
});

function displayMetadata(metadata, container) {
    container.innerHTML = '';

    if (!metadata || Object.keys(metadata).length === 0) {
        container.innerHTML = '<p style="color: #999;">No metadata available</p>';
        return;
    }

    // Filter and sort important metadata fields
    const importantFields = [
        'Artist', 'Comment', 'CompatibleBrands', 'CompressorName',
        'CreateDate', 'CreationTime', 'Encoder', 'FileModifyDate',
        'MajorBrand', 'Make', 'MaxBitrate', 'MediaCreateDate',
        'MediaDataOffset', 'MediaDataSize', 'MediaModifyDate',
        'MinorVersion', 'Model', 'ModifyDate', 'Software', 'Title',
        'TrackCreateDate', 'TrackModifyDate'
    ];

    const sortedKeys = Object.keys(metadata)
        .filter(key => importantFields.includes(key))
        .sort((a, b) => importantFields.indexOf(a) - importantFields.indexOf(b));

    const otherKeys = Object.keys(metadata)
        .filter(key => !importantFields.includes(key))
        .sort();

    [...sortedKeys, ...otherKeys].forEach(key => {
        const value = metadata[key];
        if (value !== null && value !== undefined && value !== '') {
            const item = document.createElement('div');
            item.className = 'metadata-item';
            item.innerHTML = `
                <span class="metadata-key">${key}:</span>
                <span class="metadata-value">${formatMetadataValue(value)}</span>
            `;
            container.appendChild(item);
        }
    });
}

function formatMetadataValue(value) {
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

