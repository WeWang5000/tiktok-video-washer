let currentFileId = null;
let currentFileExt = null;
let washedFilename = null;
let pendingBeforeMetadata = null;
let pendingAfterMetadata = null;

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
const metadataLock = document.getElementById('metadataLock');
const metadataContent = document.getElementById('metadataContent');
const metadataCodeInput = document.getElementById('metadataCodeInput');
const metadataUnlockBtn = document.getElementById('metadataUnlockBtn');
const metadataError = document.getElementById('metadataError');
const uploadIcon = document.getElementById('uploadIcon');
const uploadText = document.getElementById('uploadText');
const uploadLoading = document.getElementById('uploadLoading');
const uploadProgress = document.getElementById('uploadProgress');
const washLoading = document.getElementById('washLoading');
const processOverlay = document.getElementById('processOverlay');
const processTitle = document.getElementById('processTitle');
const processSubtitle = document.getElementById('processSubtitle');
const processSteps = document.getElementById('processSteps');
const metadataLockConfig = window.metadataLockConfig || { enabled: true, codeHash: '' };
let metadataUnlocked = !metadataLockConfig.enabled || !metadataLockConfig.codeHash;
let currentProcessType = null;

const PROCESS_CONFIG = {
    upload: {
        title: 'Uploading & Scanning',
        subtitle: 'We’re uploading securely and taking an exact metadata snapshot.',
        steps: [
            {
                id: 'uploading',
                title: 'Secure upload',
                description: 'Sending your file with encrypted HTTPS.'
            },
            {
                id: 'metadata',
                title: 'Metadata snapshot',
                description: 'Recording every field before changes.'
            }
        ]
    },
    wash: {
        title: 'Washing Video',
        subtitle: 'We remove the old metadata and write clean Apple-style tags.',
        steps: [
            {
                id: 'prep',
                title: 'Removing originals',
                description: 'FFmpeg strips every existing tag instantly.'
            },
            {
                id: 'rewrite',
                title: 'Writing new identity',
                description: 'ExifTool stamps fresh Apple/iPhone metadata.'
            },
            {
                id: 'finalize',
                title: 'Optimizing & sealing',
                description: 'Fast-start enabled and file prepared for download.'
            }
        ]
    }
};

if (metadataUnlockBtn) {
    metadataUnlockBtn.addEventListener('click', handleMetadataUnlock);
}

if (metadataCodeInput) {
    metadataCodeInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            handleMetadataUnlock();
        }
    });
}

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
    startProcessOverlay('upload');
    
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
        resetMetadataState();
        successBanner.style.display = 'none';

        // Use XMLHttpRequest for progress tracking
        const data = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    setTextContent(uploadProgress, percentComplete + '%');
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
        setTextContent(fileName, data.filename);
        setTextContent(fileSize, formatFileSize(data.file_size));
        fileInfo.style.display = 'block';

        setProcessStepState('uploading', 'complete');
        setProcessStepState('metadata', 'active');

        pendingBeforeMetadata = data.metadata_before || {};
        pendingAfterMetadata = null;
        metadataAfter.innerHTML = '';
        metadataComparison.style.display = 'block';
        updateMetadataVisibility();

        setProcessStepState('metadata', 'complete');
        completeProcessOverlay();

        // Show wash button
        washBtn.style.display = 'flex';
        washBtn.disabled = false;

    } catch (error) {
        hideUploadLoading();
        hideProcessOverlay();
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
    
    setTextContent(uploadProgress, '0%');
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
    startProcessOverlay('wash');

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
        setProcessStepState('prep', 'complete');
        setProcessStepState('rewrite', 'active');
        
        // Hide loading indicator
        if (washLoading) {
            washLoading.style.display = 'none';
        }
        
        washedFilename = data.washed_filename;

        // Display metadata after
        pendingAfterMetadata = data.metadata_after || {};
        updateMetadataVisibility();
        setProcessStepState('rewrite', 'complete');
        setProcessStepState('finalize', 'active');

        // Update file size
        setTextContent(fileSize, formatFileSize(data.file_size));

        // Show success banner
        successBanner.style.display = 'flex';

        // Show download button
        downloadBtn.style.display = 'flex';
        downloadBtn.disabled = false;

        washBtn.innerHTML = '<span class="btn-icon">🚀</span> Wash Video';
        washBtn.disabled = true;
        setProcessStepState('finalize', 'complete');
        completeProcessOverlay();

    } catch (error) {
        console.error('Wash error:', error);
        
        // Hide loading indicator on error
        if (washLoading) {
            washLoading.style.display = 'none';
        }
        
        alert('Error: ' + error.message);
        washBtn.innerHTML = '<span class="btn-icon">🚀</span> Wash Video';
        washBtn.disabled = false;
        hideProcessOverlay();
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

function resetMetadataState() {
    pendingBeforeMetadata = null;
    pendingAfterMetadata = null;
    if (metadataBefore) metadataBefore.innerHTML = '';
    if (metadataAfter) metadataAfter.innerHTML = '';
}

function updateMetadataVisibility() {
    if (!metadataComparison) return;

    if (metadataUnlocked) {
        if (metadataLock) metadataLock.style.display = 'none';
        if (metadataContent) metadataContent.style.display = 'grid';
        if (pendingBeforeMetadata && metadataBefore) {
            displayMetadata(pendingBeforeMetadata, metadataBefore);
        }
        if (pendingAfterMetadata && metadataAfter) {
            displayMetadata(pendingAfterMetadata, metadataAfter);
        }
    } else {
        if (metadataLock) metadataLock.style.display = 'flex';
        if (metadataContent) metadataContent.style.display = 'none';
        if (metadataBefore) metadataBefore.innerHTML = '';
        if (metadataAfter) metadataAfter.innerHTML = '';
    }
}

async function handleMetadataUnlock() {
    if (!metadataLockConfig.enabled || !metadataLockConfig.codeHash) {
        metadataUnlocked = true;
        updateMetadataVisibility();
        return;
    }

    const enteredCode = (metadataCodeInput?.value || '').trim();
    if (!enteredCode) {
        showMetadataError('Enter the access code to continue.');
        return;
    }

    try {
        const enteredHash = await hashText(enteredCode);
        if (enteredHash === metadataLockConfig.codeHash) {
            metadataUnlocked = true;
            showMetadataError('');
            if (metadataCodeInput) metadataCodeInput.value = '';
            updateMetadataVisibility();
        } else {
            showMetadataError('Incorrect code. Please try again.');
        }
    } catch (err) {
        console.error('Metadata unlock error:', err);
        showMetadataError('Unable to verify code. Please try again.');
    }
}

function showMetadataError(message) {
    if (!metadataError) return;
    if (message) {
        metadataError.textContent = message;
        metadataError.style.display = 'block';
    } else {
        metadataError.textContent = '';
        metadataError.style.display = 'none';
    }
}

async function hashText(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function startProcessOverlay(type) {
    const config = PROCESS_CONFIG[type];
    if (!processOverlay || !config) {
        return;
    }
    currentProcessType = type;
    if (processTitle) processTitle.textContent = config.title;
    if (processSubtitle) processSubtitle.textContent = config.subtitle;
    if (processSteps) {
        processSteps.innerHTML = '';
        config.steps.forEach((step, index) => {
            const stepEl = document.createElement('div');
            stepEl.className = 'process-step';
            stepEl.dataset.stepId = step.id;
            stepEl.dataset.state = index === 0 ? 'active' : 'pending';
            stepEl.innerHTML = `
                <div class="process-step-icon"></div>
                <div class="process-step-text">
                    <h4>${step.title}</h4>
                    <p>${step.description}</p>
                </div>
            `;
            processSteps.appendChild(stepEl);
        });
    }
    processOverlay.style.display = 'flex';
    document.body.classList.add('process-overlay-active');
}

function setProcessStepState(stepId, state) {
    if (!processSteps) return;
    const step = processSteps.querySelector(`[data-step-id="${stepId}"]`);
    if (step) {
        step.dataset.state = state;
    }
}

function completeProcessOverlay() {
    if (!processOverlay || processOverlay.style.display === 'none') return;
    setTimeout(() => {
        hideProcessOverlay();
    }, 300);
}

function hideProcessOverlay() {
    if (!processOverlay) return;
    processOverlay.style.display = 'none';
    document.body.classList.remove('process-overlay-active');
    currentProcessType = null;
    if (processSteps) {
        processSteps.innerHTML = '';
    }
}

function setTextContent(element, value) {
    if (!element) {
        console.warn('Missing element for text assignment. Skipping update.');
        return;
    }
    element.textContent = value;
}

