/**
 * GAITMATRIX / OA-Sense - UI & Visualizations Module
 * High-Performance Canvas Rendering, Animated Biomechanical Skeleton,
 * Interactive Pipeline Visualizations, Presentation Mode & Full Automated Demo Runner
 */

export class UIEngine {
    constructor() {
        this.animationFrameId = null;
        this.isSkeletonAnimating = false;
        this.demoTimeoutIds = [];
        this.isFullDemoRunning = false;
        this.isPresentationMode = false;
        this.currentPresentationSlide = 0;
        this.presentationSlides = [
            { id: 'pres-data', title: '1. Multimodal Patient Intake & Data Acquisition', view: 'view-new-screening' },
            { id: 'pres-sensors', title: '2. Live Sensor Hardware Simulation (Camera, 4 IMUs, 8 FSRs)', view: 'view-sensor-monitor' },
            { id: 'pres-processing', title: '3. Digital Preprocessing & Gait Segmentation Pipeline', view: 'view-signal-processing' },
            { id: 'pres-features', title: '4. Biomechanical & Kinematic Feature Extraction', view: 'view-feature-engine' },
            { id: 'pres-training', title: '5. Participant-Level Model Training (RF & XGBoost-Style)', view: 'view-ml-lab' },
            { id: 'pres-inference', title: '6. Real-Time Edge Inference & Dual-Model Comparison', view: 'view-inference' },
            { id: 'pres-decision', title: '7. Explainability & Feature Contribution Attribution', view: 'view-inference' },
            { id: 'pres-report', title: '8. Clinical Referral Decision Support Report', view: 'view-screening-reports' }
        ];
    }

    /**
     * Render the 2D animated sagittal skeleton on the canvas
     */
    drawSkeleton(canvas, pose, isSimulated = true) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        // Background grid
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 30) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += 30) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Ground reference line
        const groundY = 275;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(10, groundY);
        ctx.lineTo(width - 10, groundY);
        ctx.stroke();
        ctx.setLineDash([]);

        if (!pose || !pose.landmarks) {
            // Default standing pose if none supplied
            ctx.fillStyle = '#64748b';
            ctx.font = '12px Inter, sans-serif';
            ctx.fillText('Awaiting live camera pose stream...', 30, 140);
            return;
        }

        const lm = pose.landmarks;

        // Torso & Head
        const neckX = lm.hip.x;
        const neckY = lm.hip.y - 75;
        const headY = neckY - 22;

        // Head
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(neckX, headY, 14, 0, Math.PI * 2);
        ctx.fill();

        // Spine
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(neckX, neckY);
        ctx.lineTo(lm.hip.x, lm.hip.y);
        ctx.stroke();

        // Left Leg (Primary Foreground - Slate Dark)
        ctx.strokeStyle = '#0284c7'; // Cyan/Blue Primary
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(lm.hip.x, lm.hip.y);
        ctx.lineTo(lm.leftKnee.x, lm.leftKnee.y);
        ctx.lineTo(lm.leftAnkle.x, lm.leftAnkle.y);
        ctx.lineTo(lm.leftFoot.x, lm.leftFoot.y);
        ctx.stroke();

        // Right Leg (Secondary Background - Slate Light)
        ctx.strokeStyle = '#94a3b8'; // Muted Slate
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(lm.hip.x, lm.hip.y);
        ctx.lineTo(lm.rightKnee.x, lm.rightKnee.y);
        ctx.lineTo(lm.rightAnkle.x, lm.rightAnkle.y);
        ctx.lineTo(lm.rightFoot.x, lm.rightFoot.y);
        ctx.stroke();

        // Joint Markers
        const joints = [
            { pt: lm.hip, r: 6, color: '#0f172a', label: 'Hip' },
            { pt: lm.leftKnee, r: 6, color: '#0284c7', label: 'L-Knee' },
            { pt: lm.leftAnkle, r: 5, color: '#0d9488', label: 'L-Ankle' },
            { pt: lm.rightKnee, r: 5, color: '#64748b', label: 'R-Knee' }
        ];

        joints.forEach(j => {
            ctx.fillStyle = j.color;
            ctx.beginPath();
            ctx.arc(j.pt.x, j.pt.y, j.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        // Overlay angle indicator on Left Knee
        if (pose.angles) {
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 11px JetBrains Mono, monospace';
            ctx.fillText(`θ_knee: ${Math.round(pose.angles.leftKneeFlexion)}°`, lm.leftKnee.x + 12, lm.leftKnee.y - 4);
        }

        // Watermark badge
        ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
        ctx.fillRect(8, 8, 160, 22);
        ctx.fillStyle = '#475569';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText('SIMULATED CAMERA STREAM', 14, 23);
    }

    /**
     * Render multi-channel waveform on Canvas
     */
    drawWaveform(canvas, timeArray, signalArray, label, unit = 'deg/s', color = '#0284c7', highlightZero = true) {
        if (!canvas || !signalArray || signalArray.length === 0) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        // Find min and max
        let min = Math.min(...signalArray);
        let max = Math.max(...signalArray);
        if (min === max) { min -= 1; max += 1; }
        const margin = (max - min) * 0.15;
        min -= margin;
        max += margin;

        // Grid lines
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Zero line if within range
        if (highlightZero && min < 0 && max > 0) {
            const zeroY = height - ((0 - min) / (max - min)) * height;
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(0, zeroY);
            ctx.lineTo(width, zeroY);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw signal curve
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const n = signalArray.length;
        for (let i = 0; i < n; i++) {
            const x = (i / (n - 1)) * width;
            const y = height - ((signalArray[i] - min) / (max - min)) * height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Channel header overlay
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText(`${label}: ${signalArray[signalArray.length - 1].toFixed(1)} ${unit}`, 8, 14);
    }

    /**
     * Render 3x3 Confusion Matrix Heatmap
     */
    renderConfusionMatrix(containerId, cm, targetClasses = ['LOW', 'MODERATE', 'ELEVATED']) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let total = 0;
        cm.forEach(row => row.forEach(val => total += val));

        let html = `
            <div class="cm-table-wrapper">
                <table class="cm-table">
                    <thead>
                        <tr>
                            <th class="cm-corner" rowspan="2">Actual \\ Predicted</th>
                            <th colspan="3" class="cm-top-header">Predicted Screening Class</th>
                        </tr>
                        <tr>
                            ${targetClasses.map(c => `<th class="cm-col-header">${c}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (let r = 0; r < cm.length; r++) {
            html += `<tr><th class="cm-row-header">${targetClasses[r]}</th>`;
            for (let c = 0; c < cm[r].length; c++) {
                const val = cm[r][c];
                const pct = total > 0 ? (val / total) * 100 : 0;
                const isDiagonal = r === c;
                const bgIntensity = isDiagonal 
                    ? `rgba(2, 132, 199, ${Math.max(0.15, val / 30)})` 
                    : `rgba(239, 68, 68, ${Math.min(0.7, val / 15)})`;
                const textColor = isDiagonal && val > 15 ? '#ffffff' : '#0f172a';

                html += `
                    <td class="cm-cell ${isDiagonal ? 'cm-diag' : 'cm-offdiag'}" style="background-color: ${val > 0 ? bgIntensity : '#f8fafc'}; color: ${textColor}">
                        <div class="cm-val">${val}</div>
                        <div class="cm-pct">${pct.toFixed(1)}%</div>
                    </td>
                `;
            }
            html += `</tr>`;
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * Render Loss Curve Canvas for Gradient Boosting
     */
    drawLossCurve(canvas, trainLosses, valLosses) {
        if (!canvas || !trainLosses || trainLosses.length === 0) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        // Max loss
        const allLosses = [...trainLosses, ...(valLosses || [])];
        let maxLoss = Math.max(...allLosses);
        let minLoss = Math.min(...allLosses);
        if (maxLoss === minLoss) maxLoss += 0.5;
        const margin = (maxLoss - minLoss) * 0.1;
        maxLoss += margin;
        minLoss = Math.max(0, minLoss - margin);

        // Axes grid
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.strokeRect(30, 10, width - 40, height - 30);

        // Draw Training Loss (Blue)
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const n = trainLosses.length;
        for (let i = 0; i < n; i++) {
            const x = 30 + (i / Math.max(1, n - 1)) * (width - 40);
            const y = height - 20 - ((trainLosses[i] - minLoss) / (maxLoss - minLoss)) * (height - 30);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw Validation Loss (Orange/Teal)
        if (valLosses && valLosses.length > 0) {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            for (let i = 0; i < valLosses.length; i++) {
                const x = 30 + (i / Math.max(1, valLosses.length - 1)) * (width - 40);
                const y = height - 20 - ((valLosses[i] - minLoss) / (maxLoss - minLoss)) * (height - 30);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Labels
        ctx.fillStyle = '#64748b';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillText(`Loss: ${minLoss.toFixed(2)}`, 2, height - 22);
        ctx.fillText(`${maxLoss.toFixed(2)}`, 2, 20);
        ctx.fillText(`Iter: 1`, 30, height - 6);
        ctx.fillText(`Iter: ${n}`, width - 45, height - 6);
    }

    /**
     * Render Horizontal Feature Attribution Bars
     */
    renderFeatureAttributions(containerId, topContributors) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = '';
        topContributors.forEach(item => {
            html += `
                <div class="attr-bar-row">
                    <div class="attr-bar-label-group">
                        <span class="attr-bar-name">${item.label}</span>
                        <span class="attr-bar-value">${item.value} (${item.contributionScore.toFixed(2)} pt)</span>
                    </div>
                    <div class="attr-bar-track">
                        <div class="attr-bar-fill" style="width: ${item.relativePercentage}%"></div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * Start/Stop Presentation Mode
     */
    togglePresentationMode(enable = null) {
        this.isPresentationMode = enable !== null ? enable : !this.isPresentationMode;
        const body = document.body;
        const presBar = document.getElementById('presentation-nav-bar');

        if (this.isPresentationMode) {
            body.classList.add('presentation-mode-active');
            if (presBar) presBar.style.display = 'flex';
            this.goToPresentationSlide(0);
        } else {
            body.classList.remove('presentation-mode-active');
            if (presBar) presBar.style.display = 'none';
        }
        return this.isPresentationMode;
    }

    goToPresentationSlide(index) {
        if (index < 0) index = 0;
        if (index >= this.presentationSlides.length) index = this.presentationSlides.length - 1;
        this.currentPresentationSlide = index;

        const slide = this.presentationSlides[index];
        const titleEl = document.getElementById('pres-slide-title');
        const counterEl = document.getElementById('pres-slide-counter');

        if (titleEl) titleEl.innerText = slide.title;
        if (counterEl) counterEl.innerText = `Step ${index + 1} of ${this.presentationSlides.length}`;

        // Switch to relevant workstation view
        const targetViewId = slide.view;
        const navBtn = document.querySelector(`.nav-item[data-view="${targetViewId}"]`);
        if (navBtn) navBtn.click();
    }

    nextPresentationSlide() {
        this.goToPresentationSlide(this.currentPresentationSlide + 1);
    }

    prevPresentationSlide() {
        this.goToPresentationSlide(this.currentPresentationSlide - 1);
    }

    /**
     * Execute the full 21-step automated hackathon judge demo (~35-45s)
     */
    async startFullDemo(appController) {
        if (this.isFullDemoRunning) return;
        this.isFullDemoRunning = true;

        const overlay = document.getElementById('full-demo-overlay');
        const progressFill = document.getElementById('demo-progress-fill');
        const stepBadge = document.getElementById('demo-step-badge');
        const stepDesc = document.getElementById('demo-step-desc');

        if (overlay) overlay.style.display = 'flex';

        const steps = [
            { num: 1, title: 'Session Initialization', desc: 'Creating intake profile DEMO-001 with patient context', view: 'view-new-screening', action: () => appController.loadDemoIntake() },
            { num: 2, title: 'Multi-Sensor Simulation', desc: 'Generating synchronized 100 Hz IMU, FSR & 30 FPS Camera streams', view: 'view-sensor-monitor', action: () => appController.runSensorAcquisition() },
            { num: 3, title: 'Live Biomechanical Capture', desc: 'Visualizing 2D sagittal pose skeleton and triaxial inertial streams', view: 'view-sensor-monitor', action: () => {} },
            { num: 4, title: 'Digital Calibration', desc: 'Applying zero-velocity bias tare and standing reference offset', view: 'view-signal-processing', action: () => appController.runCalibration() },
            { num: 5, title: 'Butterworth Lowpass Filtering', desc: 'Filtering raw signals (fc = 6 Hz) to suppress high-frequency noise', view: 'view-signal-processing', action: () => appController.runFiltering() },
            { num: 6, title: 'Master Time Synchronization', desc: 'Aligning camera timestamps with IMU/FSR hardware clock (< 2ms jitter)', view: 'view-signal-processing', action: () => appController.runSynchronization() },
            { num: 7, title: 'Signal Quality Assurance', desc: 'Verifying continuous stream packet integrity and SNR > 28 dB', view: 'view-signal-processing', action: () => appController.runQualityCheck() },
            { num: 8, title: 'Biomechanical Gait Segmentation', desc: 'Detecting Initial Contacts, Toe-Offs, and normalizing gait cycles', view: 'view-signal-processing', action: () => appController.runSegmentation() },
            { num: 9, title: 'Kinematic Orientation Extraction', desc: 'Computing relative thigh-shank angle: Q_rel = inv(Q_thigh) * Q_shank', view: 'view-feature-engine', action: () => appController.runFeatureExtraction() },
            { num: 10, title: 'Plantar Loading & COP Proxy', desc: 'Calculating relative heel vs forefoot loading and loading asymmetry', view: 'view-feature-engine', action: () => {} },
            { num: 11, title: 'Multimodal Feature Vector Fusion', desc: 'Assembling 12-dimensional multimodal feature vector', view: 'view-feature-engine', action: () => {} },
            { num: 12, title: 'Research Dataset Synthesis', desc: 'Generating 350 multi-trial synthetic demonstration samples across 50 subjects', view: 'view-ml-lab', action: () => appController.generateDataset() },
            { num: 13, title: 'Participant-Level Partitioning', desc: 'Enforcing strict 70/15/15 subject split with ZERO data leakage', view: 'view-ml-lab', action: () => appController.splitDataset() },
            { num: 14, title: 'Random Forest Training', desc: 'Training 25 client-side decision trees with bootstrap bagging and feature subsampling', view: 'view-ml-lab', action: () => appController.trainRandomForest() },
            { num: 15, title: 'XGBoost-Style Gradient Boosting', desc: 'Sequential boosting of weak regression trees fit to multi-class pseudo-residuals', view: 'view-ml-lab', action: () => appController.trainGradientBoosting() },
            { num: 16, title: 'Holdout Validation & Evaluation', desc: 'Computing dynamic Accuracy, Macro F1, Sensitivity, and Confusion Matrices', view: 'view-ml-lab', action: () => appController.evaluateModels() },
            { num: 17, title: 'Real-Time Edge Inference', desc: 'Passing DEMO-001 multimodal feature vector through deployed models', view: 'view-inference', action: () => appController.runInference() },
            { num: 18, title: 'Ensemble Decision Layer', desc: 'Combining soft probability distributions to derive screening tier', view: 'view-inference', action: () => {} },
            { num: 19, title: 'Explainability Engine', desc: 'Calculating top kinematic contributors and biomechanical attribution', view: 'view-inference', action: () => {} },
            { num: 20, title: 'Printable Referral Report Generation', desc: 'Compiling clinical referral decision support document', view: 'view-screening-reports', action: () => appController.generateReport() },
            { num: 21, title: 'Offline Local Storage', desc: 'Persisting pseudonymous screening record to local storage', view: 'view-screening-reports', action: () => appController.saveSession() }
        ];

        for (let i = 0; i < steps.length; i++) {
            if (!this.isFullDemoRunning) break;
            const s = steps[i];

            // Update UI banner
            if (progressFill) progressFill.style.width = `${((i + 1) / steps.length) * 100}%`;
            if (stepBadge) stepBadge.innerText = `Step ${s.num} / ${steps.length}: ${s.title}`;
            if (stepDesc) stepDesc.innerText = s.desc;

            // Switch view
            const navBtn = document.querySelector(`.nav-item[data-view="${s.view}"]`);
            if (navBtn) navBtn.click();

            // Execute step action
            try {
                await s.action();
            } catch (err) {
                console.error(`Demo step ${s.num} error:`, err);
            }

            // Delay for readability (1.8s per step)
            await new Promise(r => {
                const id = setTimeout(r, 1800);
                this.demoTimeoutIds.push(id);
            });
        }

        this.stopFullDemo();
    }

    stopFullDemo() {
        this.isFullDemoRunning = false;
        this.demoTimeoutIds.forEach(id => clearTimeout(id));
        this.demoTimeoutIds = [];
        const overlay = document.getElementById('full-demo-overlay');
        if (overlay) overlay.style.display = 'none';
    }
}
