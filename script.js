// ========================================
// CONFIGURATION
// ========================================
// IMPORTANT: Replace this URL with your Teachable Machine model URL
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/p6yFuUC_d/";


// ========================================
// GLOBAL VARIABLES
// ========================================
let model, webcam, maxPredictions;
let isModelLoaded = false;
let isPredicting = false;
let stream = null;

// Statistics
let totalPredictions = 0;
let confidenceSum = 0;
let lastPredictionTime = 0;

// ========================================
// DOM ELEMENTS
// ========================================
const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');
const uploadButton = document.getElementById('upload-button');
const imageUpload = document.getElementById('image-upload');
const statusDiv = document.getElementById('status');
const webcamElement = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// ========================================
// EVENT LISTENERS
// ========================================
startButton.addEventListener('click', startWebcam);
stopButton.addEventListener('click', stopWebcam);
uploadButton.addEventListener('click', () => imageUpload.click());
imageUpload.addEventListener('change', handleImageUpload);

// ========================================
// INITIALIZE
// ========================================
async function init() {
    try {
        updateStatus('Loading AI model...', 'loading');
        
        // Load the model
        const modelURL = MODEL_URL + "model.json";
        const metadataURL = MODEL_URL + "metadata.json";
        
        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();
        
        isModelLoaded = true;
        updateStatus('Model loaded! Ready to start.', 'ready');
        startButton.disabled = false;
        uploadButton.disabled = false;
        
    } catch (error) {
        console.error('Error loading model:', error);
        updateStatus('Error loading model. Please check the model URL.', 'error');
    }
}

// ========================================
// WEBCAM FUNCTIONS
// ========================================
async function startWebcam() {
    if (!isModelLoaded) {
        alert('Please wait for the model to load first.');
        return;
    }
    
    try {
        updateStatus('Starting camera...', 'loading');
        
        // Request webcam access
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: 640, 
                height: 480 
            } 
        });
        
        webcamElement.srcObject = stream;
        webcamElement.play();
        
        // Setup canvas
        canvas.width = 640;
        canvas.height = 480;
        
        // Update UI
        startButton.disabled = true;
        stopButton.disabled = false;
        uploadButton.disabled = true;
        document.querySelector('.camera-container').classList.add('camera-active');
        
        updateStatus('Camera active. Predicting...', 'ready');
        
        // Start prediction loop
        isPredicting = true;
        predictWebcam();
        
    } catch (error) {
        console.error('Error accessing webcam:', error);
        updateStatus('Could not access camera. Please check permissions.', 'error');
    }
}

function stopWebcam() {
    isPredicting = false;
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        webcamElement.srcObject = null;
    }
    
    // Update UI
    startButton.disabled = false;
    stopButton.disabled = true;
    uploadButton.disabled = false;
    document.querySelector('.camera-container').classList.remove('camera-active');
    
    updateStatus('Camera stopped.', '');
}

async function predictWebcam() {
    if (!isPredicting) return;
    
    try {
        const startTime = performance.now();
        
        // Draw current frame to canvas
        ctx.drawImage(webcamElement, 0, 0, canvas.width, canvas.height);
        
        // Make prediction
        const prediction = await model.predict(canvas);
        
        const endTime = performance.now();
        const processingTime = Math.round(endTime - startTime);
        
        // Display predictions
        displayPredictions(prediction, processingTime);
        
        // Continue loop
        requestAnimationFrame(predictWebcam);
        
    } catch (error) {
        console.error('Prediction error:', error);
    }
}

// ========================================
// IMAGE UPLOAD FUNCTIONS
// ========================================
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    updateStatus('Processing image...', 'loading');
    
    // Display preview
    const reader = new FileReader();
    reader.onload = async function(e) {
        const preview = document.getElementById('upload-preview');
        preview.innerHTML = `<img src="${e.target.result}" alt="Uploaded image">`;
        
        // Create image element for prediction
        const img = new Image();
        img.onload = async function() {
            try {
                const startTime = performance.now();
                
                // Make prediction
                const prediction = await model.predict(img);
                
                const endTime = performance.now();
                const processingTime = Math.round(endTime - startTime);
                
                // Display predictions
                displayPredictions(prediction, processingTime);
                updateStatus('Prediction complete!', 'ready');
                
            } catch (error) {
                console.error('Prediction error:', error);
                updateStatus('Error making prediction.', 'error');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ========================================
// DISPLAY FUNCTIONS
// ========================================
function displayPredictions(predictions, processingTime) {
    // Sort predictions by probability (highest first)
    const sortedPredictions = predictions.sort((a, b) => b.probability - a.probability);
    
    // Update statistics
    totalPredictions++;
    confidenceSum += sortedPredictions[0].probability;
    lastPredictionTime = processingTime;
    updateStatistics();
    
    // Show predictions container
    document.querySelector('.no-prediction').style.display = 'none';
    document.getElementById('predictions').style.display = 'block';
    
    // Display top prediction
    const topPrediction = sortedPredictions[0];
    document.getElementById('top-prediction').textContent = topPrediction.className;
    document.getElementById('top-confidence').textContent = 
        `${(topPrediction.probability * 100).toFixed(1)}%`;
    document.getElementById('top-bar').style.width = 
        `${topPrediction.probability * 100}%`;
    
    // Display other predictions (top 3)
    const otherPredictionsDiv = document.getElementById('other-predictions');
    otherPredictionsDiv.innerHTML = '';
    
    for (let i = 1; i < Math.min(3, sortedPredictions.length); i++) {
        const pred = sortedPredictions[i];
        const confidence = (pred.probability * 100).toFixed(1);
        
        const predElement = document.createElement('div');
        predElement.className = 'prediction-item';
        predElement.innerHTML = `
            <div class="prediction-label">
                <span class="item-name">${pred.className}</span>
                <span class="confidence">${confidence}%</span>
            </div>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${confidence}%"></div>
            </div>
        `;
        
        otherPredictionsDiv.appendChild(predElement);
    }
}

function updateStatistics() {
    // Total predictions
    document.getElementById('total-predictions').textContent = totalPredictions;
    
    // Average confidence
    const avgConfidence = (confidenceSum / totalPredictions * 100).toFixed(1);
    document.getElementById('avg-confidence').textContent = `${avgConfidence}%`;
    
    // Processing time
    document.getElementById('processing-time').textContent = `${lastPredictionTime}ms`;
}

function updateStatus(message, className = '') {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + className;
}

// ========================================
// START APPLICATION
// ========================================
window.addEventListener('load', () => {
    // Check if model URL is set
    if (MODEL_URL === "YOUR_MODEL_URL_HERE/") {
        updateStatus('Please set your model URL in script.js', 'error');
        startButton.disabled = true;
        uploadButton.disabled = true;
        return;
    }
    
    // Initialize the application
    init();
});

// ========================================
// UTILITY FUNCTIONS
// ========================================
// Clean up when page is closed
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});