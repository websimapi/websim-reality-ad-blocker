class RealityAdBlocker {
    constructor() {
        this.video = document.getElementById('videoFeed');
        this.canvas = document.getElementById('overlayCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isBlocking = false;
        this.detectedAds = [];
        this.detectionInterval = null;
        this.sensitivity = 'normal'; // normal, high, low
        this.frameCount = 0;
        
        this.initializeCamera();
        this.setupEventListeners();
        this.setupCanvas();
    }

    async initializeCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });
            
            this.video.srcObject = stream;
            this.video.addEventListener('loadedmetadata', () => {
                this.setupCanvas();
                document.getElementById('loading').style.display = 'none';
                this.updateStatus('Camera Ready');
            });
        } catch (error) {
            console.error('Camera access denied:', error);
            this.updateStatus('Camera access denied');
        }
    }

    setupCanvas() {
        this.canvas.width = this.video.videoWidth || window.innerWidth;
        this.canvas.height = this.video.videoHeight || window.innerHeight;
        
        // Resize canvas to match video display
        const resizeCanvas = () => {
            const rect = this.video.getBoundingClientRect();
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
        };
        
        window.addEventListener('resize', resizeCanvas);
        setTimeout(resizeCanvas, 100);
    }

    setupEventListeners() {
        document.getElementById('toggleBtn').addEventListener('click', () => {
            this.toggleBlocking();
        });

        document.getElementById('sensitivityBtn').addEventListener('click', () => {
            this.cycleSensitivity();
        });
    }

    toggleBlocking() {
        this.isBlocking = !this.isBlocking;
        const btn = document.getElementById('toggleBtn');
        
        if (this.isBlocking) {
            btn.textContent = 'Stop Blocking';
            btn.classList.add('active');
            this.startDetection();
            this.updateStatus('Blocking Active');
        } else {
            btn.textContent = 'Start Blocking';
            btn.classList.remove('active');
            this.stopDetection();
            this.clearOverlays();
            this.updateStatus('Blocking Disabled');
        }
    }

    cycleSensitivity() {
        const modes = ['normal', 'high', 'low'];
        const currentIndex = modes.indexOf(this.sensitivity);
        this.sensitivity = modes[(currentIndex + 1) % modes.length];
        
        const btn = document.getElementById('sensitivityBtn');
        btn.textContent = `${this.sensitivity.charAt(0).toUpperCase() + this.sensitivity.slice(1)} Mode`;
        
        this.updateStatus(`Sensitivity: ${this.sensitivity}`);
    }

    startDetection() {
        this.detectionInterval = setInterval(() => {
            this.detectObjects();
        }, this.getDetectionInterval());
    }

    stopDetection() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
    }

    getDetectionInterval() {
        const intervals = {
            'low': 3000,
            'normal': 2000,
            'high': 1000
        };
        return intervals[this.sensitivity];
    }

    async detectObjects() {
        if (!this.video.videoWidth || !this.video.videoHeight) return;

        this.frameCount++;
        this.updateStatus(`Scanning... (Frame ${this.frameCount})`);

        // Simulate object detection (in real app, this would use TensorFlow.js or similar)
        const mockDetections = this.simulateObjectDetection();

        if (mockDetections.length > 0) {
            // Send detection data to AI for advertisement classification
            const adClassification = await this.classifyAdvertisements(mockDetections);
            this.processDetections(adClassification);
        }

        // Update overlays
        this.updateOverlays();
    }

    simulateObjectDetection() {
        // Simulate detecting various objects in the scene
        const possibleObjects = [
            { type: 'sign', text: 'McDonald\'s', confidence: 0.95, x: 100, y: 150, width: 200, height: 80 },
            { type: 'poster', text: 'Coca-Cola', confidence: 0.88, x: 300, y: 200, width: 150, height: 100 },
            { type: 'billboard', text: 'Nike Just Do It', confidence: 0.92, x: 50, y: 50, width: 300, height: 120 },
            { type: 'sign', text: 'Stop', confidence: 0.99, x: 400, y: 300, width: 60, height: 60 },
            { type: 'text', text: 'Parking', confidence: 0.85, x: 200, y: 400, width: 80, height: 30 },
            { type: 'logo', text: 'Apple', confidence: 0.90, x: 350, y: 100, width: 50, height: 50 }
        ];

        // Randomly return some detections
        const numDetections = Math.floor(Math.random() * 3) + 1;
        return possibleObjects.slice(0, numDetections).map(obj => ({
            ...obj,
            id: `${obj.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }));
    }

    async classifyAdvertisements(detections) {
        try {
            const detectionData = detections.map(d => ({
                type: d.type,
                text: d.text,
                confidence: d.confidence
            }));

            const completion = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `You are an advertisement detection AI. Analyze the detected objects and determine which ones are advertisements or commercial content. 
                        
                        Respond with JSON only, no other text:
                        {
                            "advertisements": [
                                {
                                    "index": number,
                                    "isAd": boolean,
                                    "confidence": number,
                                    "reason": string,
                                    "category": string
                                }
                            ]
                        }`
                    },
                    {
                        role: "user",
                        content: `Detected objects: ${JSON.stringify(detectionData)}`
                    }
                ],
                json: true
            });

            const result = JSON.parse(completion.content);
            return result.advertisements;
        } catch (error) {
            console.error('AI classification error:', error);
            // Fallback: simple keyword-based detection
            return detections.map((d, index) => ({
                index,
                isAd: this.isLikelyAd(d.text),
                confidence: 0.7,
                reason: 'Keyword-based detection',
                category: 'commercial'
            }));
        }
    }

    isLikelyAd(text) {
        const adKeywords = ['mcdonald', 'coca-cola', 'nike', 'apple', 'samsung', 'google', 'facebook', 'buy', 'sale', 'offer'];
        return adKeywords.some(keyword => text.toLowerCase().includes(keyword));
    }

    processDetections(classifications) {
        const newAds = [];
        
        classifications.forEach((classification, index) => {
            if (classification.isAd) {
                const detection = this.simulateObjectDetection()[index];
                if (detection) {
                    newAds.push({
                        ...detection,
                        classification: classification,
                        timestamp: Date.now()
                    });
                }
            }
        });

        // Update detected ads list
        this.detectedAds = [...this.detectedAds, ...newAds];
        
        // Remove old detections (older than 10 seconds)
        const now = Date.now();
        this.detectedAds = this.detectedAds.filter(ad => now - ad.timestamp < 10000);

        // Update detection log
        if (newAds.length > 0) {
            const logElement = document.getElementById('detectionLog');
            const adNames = newAds.map(ad => ad.text).join(', ');
            logElement.innerHTML = `<strong>Blocked:</strong> ${adNames}<br>` + logElement.innerHTML;
        }
    }

    updateOverlays() {
        this.clearOverlays();
        
        this.detectedAds.forEach(ad => {
            this.createAdOverlay(ad);
        });
    }

    createAdOverlay(ad) {
        // Create blur overlay
        const overlay = document.createElement('div');
        overlay.className = 'blur-overlay';
        overlay.style.left = ad.x + 'px';
        overlay.style.top = ad.y + 'px';
        overlay.style.width = ad.width + 'px';
        overlay.style.height = ad.height + 'px';
        
        // Create ad label
        const label = document.createElement('div');
        label.className = 'ad-label';
        label.textContent = 'AD BLOCKED';
        label.style.left = ad.x + 'px';
        label.style.top = (ad.y - 25) + 'px';
        
        document.body.appendChild(overlay);
        document.body.appendChild(label);
        
        // Auto-remove after animation
        setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (label.parentNode) label.parentNode.removeChild(label);
        }, 5000);
    }

    clearOverlays() {
        // Remove all existing overlays
        const overlays = document.querySelectorAll('.blur-overlay, .ad-label');
        overlays.forEach(overlay => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        });
    }

    updateStatus(message) {
        document.getElementById('status').textContent = message;
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new RealityAdBlocker();
});

