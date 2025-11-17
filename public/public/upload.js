// Document Upload JavaScript

let selectedFile = null;
let allUploads = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  setupUploadArea();
  loadUploads();
});

function setupUploadArea() {
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  
  uploadArea.addEventListener('click', () => {
    fileInput.click();
  });
  
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
  });
  
  uploadArea.addEventListener('dragleave', (e) => {
    e.currentTarget.classList.remove('dragover');
  });
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  });
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    handleFile(file);
  }
}

function handleFile(file) {
  // Validate file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    showError('File size must be less than 10MB');
    return;
  }
  
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    showError('Only PDF, JPG, and PNG files are allowed');
    return;
  }
  
  selectedFile = file;
  showFilePreview(file);
}

function showFilePreview(file) {
  const fileInfo = document.getElementById('file-info');
  const fileSize = (file.size / 1024 / 1024).toFixed(2);
  
  let previewHTML = `
    <div class="alert alert-info">
      <strong>Selected File:</strong> ${escapeHtml(file.name)}<br>
      <strong>Size:</strong> ${fileSize} MB<br>
      <strong>Type:</strong> ${file.type}
    </div>
  `;
  
  // Show image preview if it's an image
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewHTML += `
        <div style="margin-top: 1rem;">
          <img src="${e.target.result}" alt="Preview" style="max-width: 100%; max-height: 200px; border-radius: 8px; border: 2px solid var(--gray-light);">
        </div>
      `;
      fileInfo.innerHTML = previewHTML;
    };
    reader.readAsDataURL(file);
  } else {
    fileInfo.innerHTML = previewHTML;
  }
  
  fileInfo.style.display = 'block';
}

async function handleUpload(event) {
  event.preventDefault();
  
  if (!selectedFile) {
    showError('Please select a file first');
    return;
  }
  
  const category = document.getElementById('document-category').value;
  if (!category) {
    showError('Please select a document category');
    return;
  }
  
  const formData = new FormData();
  formData.append('document', selectedFile);
  formData.append('category', category);
  
  const statusDiv = document.getElementById('upload-status');
  const progressDiv = document.getElementById('upload-progress');
  const progressFill = document.getElementById('progress-fill');
  const uploadBtn = document.getElementById('upload-btn');
  
  uploadBtn.disabled = true;
  progressDiv.classList.add('active');
  statusDiv.innerHTML = '';
  
  // Real progress tracking (simulated for now, can be enhanced with XMLHttpRequest for real progress)
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += 5;
    if (progress <= 90) {
      progressFill.style.width = progress + '%';
      progressFill.textContent = progress + '%';
    }
  }, 150);
  
  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    clearInterval(progressInterval);
    
    // Check if response is OK
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error occurred' }));
      throw new Error(errorData.error || `Upload failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      // Complete progress
      progressFill.style.width = '100%';
      progressFill.textContent = '100%';
      
      statusDiv.innerHTML = '<div class="alert alert-success">✅ Document uploaded successfully!</div>';
      
      // Reset form
      document.getElementById('upload-form').reset();
      document.getElementById('file-info').style.display = 'none';
      selectedFile = null;
      
      // Hide progress after delay
      setTimeout(() => {
        progressDiv.classList.remove('active');
        progressFill.style.width = '0%';
        progressFill.textContent = '0%';
      }, 1500);
      
      // Reload uploads list
      loadUploads();
    } else {
      progressDiv.classList.remove('active');
      showError(data.error || 'Upload failed');
    }
  } catch (error) {
    clearInterval(progressInterval);
    progressDiv.classList.remove('active');
    
    // Display clear error message
    const errorMessage = error.message || 'Upload failed. Please try again.';
    showError(errorMessage);
    console.error('Upload error:', error);
  } finally {
    uploadBtn.disabled = false;
  }
}

async function loadUploads() {
  try {
    const response = await fetch('/api/uploads');
    const data = await response.json();
    
    if (data.success) {
      allUploads = data.uploads;
      renderUploads(allUploads);
    } else {
      showError('Error loading documents');
    }
  } catch (error) {
    document.getElementById('uploads-list').innerHTML = '<div class="alert alert-error">Error loading documents</div>';
    console.error('Load uploads error:', error);
  }
}

function renderUploads(uploads) {
  const listDiv = document.getElementById('uploads-list');
  
  if (uploads.length === 0) {
    listDiv.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 2rem;">No documents uploaded yet.</p>';
    return;
  }
  
  const categoryColors = {
    'rc': 'badge-info',
    'dl': 'badge-success',
    'puc': 'badge-warning',
    'insurance': 'badge-info',
    'invoice': 'badge',
    'other': 'badge'
  };
  
  let html = '<table class="table"><thead><tr><th>File Name</th><th>Category</th><th>Size</th><th>Uploaded</th><th>Actions</th></tr></thead><tbody>';
  
  uploads.forEach(upload => {
    const date = new Date(upload.uploadedAt).toLocaleDateString();
    const size = upload.fileSize < 1024 
      ? upload.fileSize + ' B'
      : upload.fileSize < 1024 * 1024
      ? (upload.fileSize / 1024).toFixed(2) + ' KB'
      : (upload.fileSize / 1024 / 1024).toFixed(2) + ' MB';
    
    html += `
      <tr>
        <td>${escapeHtml(upload.fileName)}</td>
        <td><span class="badge ${categoryColors[upload.category] || 'badge'}">${upload.category.toUpperCase()}</span></td>
        <td>${size}</td>
        <td>${date}</td>
        <td>
          <a href="${upload.cloudinaryUrl}" target="_blank" class="btn btn-secondary" style="padding: 0.5rem 1rem; margin-right: 0.5rem;">View</a>
          <a href="${upload.cloudinaryUrl}" download="${upload.fileName}" class="btn btn-primary" style="padding: 0.5rem 1rem;">Download</a>
        </td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  listDiv.innerHTML = html;
}

function filterUploads() {
  const searchTerm = document.getElementById('search-uploads').value.toLowerCase();
  const filtered = allUploads.filter(upload =>
    upload.fileName.toLowerCase().includes(searchTerm) ||
    upload.category.toLowerCase().includes(searchTerm)
  );
  renderUploads(filtered);
}

function showError(message) {
  const statusDiv = document.getElementById('upload-status');
  statusDiv.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(message)}</div>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make functions globally available
window.handleFileSelect = handleFileSelect;
window.handleUpload = handleUpload;
window.filterUploads = filterUploads;

