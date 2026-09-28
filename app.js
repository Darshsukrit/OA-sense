/**
 * GAITMATRIX / OA-Sense - Main Application Controller
 * ES Module Entry Point orchestrating State, Pipeline Execution & Event Dispatching
 */

import { HardwareAdapter } from './modules/simulation.js';
import { SignalPreprocessor } from './modules/preprocessing.js';
import { GaitSegmenter } from './modules/segmentation.js';
import { FeatureEngine } from './modules/features.js';
import { DatasetManager } from './modules/dataset.js';
import { RandomForestClassifier } from './modules/randomForest.js';
import { GradientBoostingClassifier } from './modules/gradientBoosting.js';
import { MetricsEvaluator } from './modules/metrics.js';
import { InferenceEngine } from './modules/inference.js';
import { RESEARCH_EVIDENCE } from './modules/research.js';
import { VALIDATION_FRAMEWORK } from './modules/validation.js';
import { ReportGenerator } from './modules/reports.js';
import { StorageManager } from './modules/storage.js';
import { UIEngine } from './modules/ui.js';

class AppController {
    constructor() {
        // Module instances
        this.hardware = new HardwareAdapter();
        this.preprocessor = new SignalPreprocessor();
        this.segmenter = new GaitSegmenter(100);
        this.featureEngine = new FeatureEngine();
        this.datasetManager = new DatasetManager(777);
        this.rfModel = new RandomForestClassifier(25, 6, 4, 3);
        this.gbModel = new GradientBoostingClassifier(20, 0.10, 3, 3);
        this.metricsEvaluator = new MetricsEvaluator(['LOW', 'MODERATE', 'ELEVATED']);
        this.inferenceEngine = new InferenceEngine();
        this.reportGenerator = new ReportGenerator();
        this.storageManager = new StorageManager();
        this.ui = new UIEngine();

        // Application State
        this.state = {
            sessionInfo: { sessionId: 'DEMO-001' },
            patientContext: {
                age: 56,
                sex: 'Female',
                height: 165,
                weight: 74,
                pain: 6,
                stiffness: 5,
                walkingDiff: 5,
                stairDiff: 6,
                prevInjury: true,
                pattern: 'restricted_flexion'
            },
            rawTrial: null,
            calibratedTrial: null,
            filteredTrial: null,
            syncedTrial: null,
            qaResult: null,
            segmentationResult: null,
            featuresResult: null,
            datasetSplit: null,
            evalMetrics: null,
            inferenceResult: null,
            reportData: null,
            skeletonAnimFrame: 0
        };
    }

    async init() {
        console.info('[GaitMatrix] Initializing Medical AI Research Workstation...');
        this._bindUIEvents();
        this._populateResearchView();
        this._populateValidationView();
        this._renderSavedSessions();

        // Automatically prepare dataset and train baseline models on startup
        await this.generateDataset();
        this.splitDataset();
        await this.trainRandomForest();
        await this.trainGradientBoosting();
        this.evaluateModels();

        // Run default simulated patient intake session
        await this.loadDemoIntake();
        await this.runSensorAcquisition();
        this.runCalibration();
        this.runFiltering();
        this.runSynchronization();
        this.runQualityCheck();
        this.runSegmentation();
        this.runFeatureExtraction();
        this.runInference();
        this.generateReport();

        this._startLiveSkeletonLoop();
        this._renderDSPStage('stage-raw');
        console.info('[GaitMatrix] System Ready. 100% Offline Mode Active.');
    }

    /* -------------------------------------------------------------
       PIPELINE EXECUTION METHODS
       ------------------------------------------------------------- */

    async loadDemoIntake(overrides = {}) {
        this.state.sessionInfo.sessionId = overrides.sessionId || 'DEMO-001';
        this.state.patientContext = {
            age: overrides.age || 56,
            sex: overrides.sex || 'Female',
            height: overrides.height || 165,
            weight: overrides.weight || 74,
            pain: overrides.pain !== undefined ? overrides.pain : 6,
            stiffness: overrides.stiffness !== undefined ? overrides.stiffness : 5,
            walkingDiff: overrides.walkingDiff !== undefined ? overrides.walkingDiff : 5,
            stairDiff: overrides.stairDiff !== undefined ? overrides.stairDiff : 6,
            prevInjury: overrides.prevInjury !== undefined ? overrides.prevInjury : true,
            pattern: overrides.pattern || 'restricted_flexion'
        };

        // Update DOM inputs
        const sId = document.getElementById('intake-session-id');
        if (sId) sId.value = this.state.sessionInfo.sessionId;
        const topSId = document.getElementById('top-session-id');
        if (topSId) topSId.innerText = this.state.sessionInfo.sessionId;

        const ageEl = document.getElementById('intake-age');
        if (ageEl) ageEl.value = this.state.patientContext.age;
        const painEl = document.getElementById('intake-pain');
        if (painEl) {
            painEl.value = this.state.patientContext.pain;
            document.getElementById('val-pain').innerText = painEl.value;
        }
        const stiffEl = document.getElementById('intake-stiffness');
        if (stiffEl) {
            stiffEl.value = this.state.patientContext.stiffness;
            document.getElementById('val-stiffness').innerText = stiffEl.value;
        }
        const patEl = document.getElementById('intake-pattern');
        if (patEl) patEl.value = this.state.patientContext.pattern;
    }

    async runSensorAcquisition() {
        // Acquire raw synchronized data stream
        this.state.rawTrial = this.hardware.acquireStream(
            5.0,
            this.state.patientContext.pattern,
            this.state.patientContext
        );

        // Update Sensor Monitor Waveforms
        this._renderSensorWaveforms();
        this._renderFSRBars();
    }

    runCalibration() {
        if (!this.state.rawTrial) return;
        this.state.calibratedTrial = this.preprocessor.calibrate(this.state.rawTrial);
    }

    runFiltering() {
        if (!this.state.calibratedTrial) this.runCalibration();
        this.state.filteredTrial = this.preprocessor.filterTrialData(this.state.calibratedTrial);
    }

    runSynchronization() {
        if (!this.state.filteredTrial) this.runFiltering();
        this.state.syncedTrial = this.preprocessor.synchronizeStreams(this.state.filteredTrial);
    }

    runQualityCheck() {
        if (!this.state.syncedTrial) this.runSynchronization();
        this.state.qaResult = this.preprocessor.performQualityCheck(this.state.syncedTrial);
    }

    runSegmentation() {
        if (!this.state.syncedTrial) this.runSynchronization();
        this.state.segmentationResult = this.segmenter.segmentTrial(this.state.syncedTrial);
    }

    runFeatureExtraction() {
        if (!this.state.syncedTrial) this.runSynchronization();
        if (!this.state.segmentationResult) this.runSegmentation();

        this.state.featuresResult = this.featureEngine.extractFeatures(
            this.state.syncedTrial,
            this.state.segmentationResult,
            this.state.patientContext
        );

        // Update Feature Engine DOM
        this._updateFeatureEngineDOM();
    }

    async generateDataset() {
        this.state.dataset = this.datasetManager.generateSyntheticDataset(50, 7);
        const dsCountEl = document.getElementById('ds-total-samples');
        if (dsCountEl) dsCountEl.innerText = this.state.dataset.metadata.totalSamples;
    }

    splitDataset() {
        this.state.datasetSplit = this.datasetManager.splitByParticipant(0.70, 0.15, 0.15);
    }

    async trainRandomForest() {
        if (!this.state.datasetSplit) this.splitDataset();
        const { train } = this.state.datasetSplit;
        const statusEl = document.getElementById('rf-status-badge');
        if (statusEl) statusEl.innerText = 'TRAINING...';

        await this.rfModel.fit(train.X, train.y);

        if (statusEl) {
            statusEl.className = 'badge badge-success';
            statusEl.innerText = 'TRAINED';
        }
    }

    async trainGradientBoosting() {
        if (!this.state.datasetSplit) this.splitDataset();
        const { train, val } = this.state.datasetSplit;
        const statusEl = document.getElementById('gb-status-badge');
        if (statusEl) statusEl.innerText = 'TRAINING...';

        await this.gbModel.fit(train.X, train.y, val.X, val.y);

        if (statusEl) {
            statusEl.className = 'badge badge-success';
            statusEl.innerText = 'TRAINED';
        }

        // Draw Loss Curve
        const lossCanvas = document.getElementById('canvas-loss-curve');
        if (lossCanvas) {
            this.ui.drawLossCurve(lossCanvas, this.gbModel.trainLossHistory, this.gbModel.valLossHistory);
        }
        const lossValEl = document.getElementById('gb-metric-loss');
        if (lossValEl && this.gbModel.trainLossHistory.length > 0) {
            lossValEl.innerText = this.gbModel.trainLossHistory[this.gbModel.trainLossHistory.length - 1];
        }
    }

    evaluateModels() {
        if (!this.state.datasetSplit || !this.rfModel.isTrained || !this.gbModel.isTrained) return;

        const { test } = this.state.datasetSplit;
        const rfPreds = this.rfModel.predictBatch(test.X);
        const gbPreds = this.gbModel.predictBatch(test.X);

        // Ensemble predictions on test set
        const ensemblePreds = [];
        for (let i = 0; i < test.X.length; i++) {
            const prf = this.rfModel.predictProbabilities(test.X[i]);
            const pgb = this.gbModel.predictProbabilities(test.X[i]);
            const pEns = [(prf[0] + pgb[0]) / 2, (prf[1] + pgb[1]) / 2, (prf[2] + pgb[2]) / 2];
            ensemblePreds.push(pEns.indexOf(Math.max(...pEns)));
        }

        const rfEval = this.metricsEvaluator.evaluate(test.y, rfPreds);
        const gbEval = this.metricsEvaluator.evaluate(test.y, gbPreds);
        const ensEval = this.metricsEvaluator.evaluate(test.y, ensemblePreds);

        this.state.evalMetrics = { rfEval, gbEval, ensEval };

        // Update comparison table
        const updateVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = typeof val === 'number' ? (val * 100).toFixed(1) →%' : val;
        };

        updateVal('rf-metric-acc', rfEval.accuracy);
        updateVal('gb-metric-acc', gbEval.accuracy);

        updateVal('comp-rf-acc', rfEval.accuracy);
        updateVal('comp-gb-acc', gbEval.accuracy);

        updateVal('comp-rf-prec', rfEval.macro.precision);
        updateVal('comp-gb-prec', gbEval.macro.precision);

        updateVal('comp-rf-rec', rfEval.macro.recall);
        updateVal('comp-gb-rec', gbEval.macro.recall);

        updateVal('comp-rf-spec', rfEval.macro.specificity);
        updateVal('comp-gb-spec', gbEval.macro.specificity);

        updateVal('comp-rf-f1', rfEval.macro.f1);
        updateVal('comp-gb-f1', gbEval.macro.f1);

        updateVal('comp-rf-wf1', rfEval.weighted.f1);
        updateVal('comp-gb-wf1', gbEval.weighted.f1);

        // Render Confusion Matrix for Ensemble
        this.ui.renderConfusionMatrix('confusion-matrix-container', ensEval.confusionMatrix);
    }

    runInference() {
        if (!this.state.featuresResult) this.runFeatureExtraction();

        const vec = this.state.featuresResult.featureVector;
        const names = this.state.featuresResult.featureNames;

        this.state.inferenceResult = this.inferenceEngine.predict(
            vec,
            this.rfModel,
            this.gbModel,
            names
        );

        this._updateInferenceDOM();
    }

    generateReport() {
        if (!this.state.inferenceResult) this.runInference();

        this.state.reportData = this.reportGenerator.generateReport({
            sessionInfo: this.state.sessionInfo,
            patientContext: this.state.patientContext,
            features: this.state.featuresResult,
            inference: this.state.inferenceResult,
            segmentation: this.state.segmentationResult,
            quality: this.state.qaResult
        });

        this._updateReportDOM();
    }

    saveSession() {
        if (!this.state.reportData) this.generateReport();
        this.storageManager.saveScreeningSession(this.state.reportData);
        this._renderSavedSessions();
    }

    /* -------------------------------------------------------------
       DOM UPDATING & RENDERING METHODS
       ------------------------------------------------------------- */

    _renderSensorWaveforms() {
        if (!this.state.rawTrial) return;
        const trial = this.state.rawTrial;
        const time = trial.time;

        const cLShank = document.getElementById('canvas-imu-l-shank');
        const cRShank = document.getElementById('canvas-imu-r-shank');
        const cLThigh = document.getElementById('canvas-imu-l-thigh');
        const cRThigh = document.getElementById('canvas-imu-r-thigh');

        this.ui.drawWaveform(cLShank, time, trial.imu.leftShank.gz, 'L-Shank Gyro Z', 'deg/s', '#0284c7');
        this.ui.drawWaveform(cRShank, time, trial.imu.rightShank.gz, 'R-Shank Gyro Z', 'deg/s', '#64748b');
        this.ui.drawWaveform(cLThigh, time, trial.imu.leftThigh.ay, 'L-Thigh Accel Y', 'g', '#0d9488');
        this.ui.drawWaveform(cRThigh, time, trial.imu.rightThigh.ay, 'R-Thigh Accel Y', 'g', '#6366f1');
    }

    _renderFSRBars() {
        if (!this.state.rawTrial) return;
        const fsr = this.state.rawTrial.fsr;
        const maxL = (arr) => Math.max(...arr).toFixed(2);

        const updateFsr = (idBar, idVal, val) => {
            const b = document.getElementById(idBar);
            const v = document.getElementById(idVal);
            if (b) b.style.width = `${Math.min(100, Math.round(val * 100))}%`;
            if (v) v.innerText = val;
        };

        updateFsr('fsr-bar-l-hallux', 'fsr-val-l-hallux', maxL(fsr.left.hallux));
        updateFsr('fsr-bar-l-meta12', 'fsr-val-l-meta12', maxL(fsr.left.meta1_2));
        updateFsr('fsr-bar-l-meta5', 'fsr-val-l-meta5', maxL(fsr.left.meta5));
        updateFsr('fsr-bar-l-heel', 'fsr-val-l-heel', maxL(fsr.left.heel));

        updateFsr('fsr-bar-r-hallux', 'fsr-val-r-hallux', maxL(fsr.right.hallux));
        updateFsr('fsr-bar-r-meta12', 'fsr-val-r-meta12', maxL(fsr.right.meta1_2));
        updateFsr('fsr-bar-r-meta5', 'fsr-val-r-meta5', maxL(fsr.right.meta5));
        updateFsr('fsr-bar-r-heel', 'fsr-val-r-heel', maxL(fsr.right.heel));
    }

    _startLiveSkeletonLoop() {
        const canvas = document.getElementById('canvas-camera-skeleton');
        const loop = () => {
            if (this.state.rawTrial && this.state.rawTrial.cameraFrames) {
                const frames = this.state.rawTrial.cameraFrames;
                const idx = this.state.skeletonAnimFrame % frames.length;
                this.ui.drawSkeleton(canvas, frames[idx]);
                this.state.skeletonAnimFrame++;
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    _updateFeatureEngineDOM() {
        if (!this.state.featuresResult) return;
        const dict = this.state.featuresResult.featureDict;
        const vec = this.state.featuresResult.featureVector;

        const setTxt = (id, txt) => {
            const el = document.getElementById(id);
            if (el) el.innerText = txt;
        };

        setTxt('feat-cam-knee', `${dict.knee_rom}°`);
        setTxt('feat-cam-cadence', `${dict.cadence} steps/min`);
        setTxt('feat-cam-timing', `${dict.step_timing} s`);
        setTxt('feat-cam-posture', `${dict.posture_lean}°`);
        setTxt('feat-cam-symm', `${(1.0 - dict.gait_asymmetry).toFixed(2)}`);

        setTxt('feat-imu-rom', `${dict.knee_rom}°`);
        setTxt('feat-imu-vel', `${dict.knee_velocity}°/s`);
        setTxt('feat-imu-asym', `${dict.gait_asymmetry}`);

        setTxt('feat-fsr-heel', `${dict.heel_loading}`);
        setTxt('feat-fsr-forefoot', `${dict.forefoot_loading}`);
        setTxt('feat-fsr-asym', `${dict.loading_asymmetry}`);
        setTxt('feat-fsr-cop', `${dict.cop_proxy} (AP Axis)`);

        setTxt('feat-ctx-age', `${dict.age} yrs`);
        setTxt('feat-ctx-pain', `${dict.pain} / 10`);
        setTxt('feat-ctx-stiffness', `${dict.stiffness} / 10`);
        setTxt('feat-ctx-walk', `${dict.walkingDifficulty} / 10`);
        setTxt('feat-ctx-bmi', `${dict.bmi} kg/m²`);
        setTxt('feat-ctx-injury', dict.prevInjury === 1 ? 'Yes' : 'No');

        const row = document.getElementById('feature-vector-row');
        if (row) {
            row.innerHTML = vec.map(v => `<td>${v}</td>`).join('');
        }
    }

    _updateInferenceDOM() {
        if (!this.state.inferenceResult) return;
        const res = this.state.inferenceResult;

        const badge = document.getElementById('infer-decision-badge');
        if (badge) {
            badge.innerText = res.screeningCategory;
            badge.className = `screening-tier-badge tier-${res.screeningCategory.toLowerCase()}`;
        }

        const conf = document.getElementById('infer-confidence-val');
        if (conf) conf.innerText = `${res.confidence}%`;

        const modelTag = document.getElementById('infer-active-model-name');
        if (modelTag) modelTag.innerText = res.selectedModel;

        // Probabilities
        const setProb = (idBar, idVal, p) => {
            const b = document.getElementById(idBar);
            const v = document.getElementById(idVal);
            if (b) b.style.width = `${Math.round(p * 100)}%`;
            if (v) v.innerText = p.toFixed(2);
        };

        setProb('prob-bar-low', 'prob-val-low', res.probabilities.LOW);
        setProb('prob-bar-mod', 'prob-val-mod', res.probabilities.MODERATE);
        setProb('prob-bar-ele', 'prob-val-ele', res.probabilities.ELEVATED);

        // Sub models
        const rfCat = document.getElementById('infer-rf-category');
        if (rfCat) rfCat.innerText = res.modelComparison.randomForest.category;
        const gbCat = document.getElementById('infer-gb-category');
        if (gbCat) gbCat.innerText = res.modelComparison.gradientBoosting.category;

        // Feature Attributions
        this.ui.renderFeatureAttributions('feature-attribution-container', res.explainability.topContributors);
    }

    _updateReportDOM() {
        if (!this.state.reportData) return;
        const rep = this.state.reportData;

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        setTxt('rep-session-id', rep.sessionId);
        setTxt('rep-date', rep.generatedAt);
        setTxt('rep-model-version', `${rep.modelName} (${rep.modelVersion})`);

        const catBadge = document.getElementById('rep-category-badge');
        if (catBadge) {
            catBadge.innerText = `${rep.screeningCategory} MOVEMENT RISK`;
            catBadge.className = `rep-category-badge ${rep.riskBadgeClass}`;
        }

        setTxt('rep-conf-score', rep.confidence);
        setTxt('rep-referral-text', rep.referralRecommendation);

        setTxt('rep-m-rom', rep.metrics.kneeRom);
        setTxt('rep-m-vel', rep.metrics.kneeVelocity);
        setTxt('rep-m-asym', rep.metrics.gaitAsymmetry);
        setTxt('rep-m-loadasym', rep.metrics.loadingAsymmetry);
        setTxt('rep-m-heel', rep.metrics.heelLoading);
        setTxt('rep-m-cadence', rep.metrics.cadence);

        setTxt('rep-p-age', `${rep.patientContext.age} / ${rep.patientContext.sex}`);
        setTxt('rep-p-pain', `${rep.patientContext.pain} / 10`);
        setTxt('rep-p-stiffness', `${rep.patientContext.stiffness} / 10`);
        setTxt('rep-p-diff', `${rep.patientContext.walkingDiff} / ${rep.patientContext.stairDiff}`);
        setTxt('rep-p-bmi', `${rep.patientContext.weight}kg (${(rep.patientContext.weight / Math.pow(rep.patientContext.height/100, 2)).toFixed(1)})`);
        setTxt('rep-p-injury', rep.patientContext.prevInjury ? 'Yes' : 'No');
    }

    _renderSavedSessions() {
        const sessions = this.storageManager.getScreeningSessions();
        const tbody = document.getElementById('saved-sessions-body');
        if (!tbody) return;

        if (sessions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No saved sessions yet.</td></tr>';
            return;
        }

        let html = '';
        sessions.forEach(s => {
            html += `
                <tr>
                    <td><strong>${s.sessionId}</strong></td>
                    <td>${s.generatedAt}</td>
                    <td><span class="badge ${s.riskBadgeClass === 'risk-elevated' ? 'badge-danger' : s.riskBadgeClass === 'risk-moderate' ? 'badge-warning' : 'badge-success'}">${s.screeningCategory}</span></td>
                    <td>${s.confidence}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    _renderDSPStage(stageId) {
        const container = document.getElementById('dsp-detail-body');
        if (!container) return;

        const stages = {
            'stage-raw': {
                title: 'Stage 1: Raw Sensor Stream Acquisition',
                input: 'Raw ADC voltage readings from 8 FSRs, I2C/SPI packets from 4 IMUs (100 Hz), and video frame buffer (30 FPS).',
                process: 'Buffering high-rate asynchronous sensor packets into structured in-memory ring buffers.',
                output: 'Unconditioned raw triaxial accelerometer, gyroscope, and analog plantar contact arrays.'
            },
            'stage-calibration': {
                title: 'Stage 2: Static Standing Reference Tare & Bias Compensation',
                input: 'Initial 2-second static quiet standing reference acquisition.',
                process: 'Subtracts resting gyro zero-offset drift and tares unloaded FSR baseline resistances to 0.0 N.',
                output: 'Zero-referenced angular velocity signals and standardized coordinate axes.'
            },
            'stage-filtering': {
                title: 'Stage 3: Digital Zero-Phase Butterworth Lowpass Filtering',
                input: 'Noisy calibrated sensor waveforms containing high-frequency shoe/floor strike transients.',
                process: 'Dual-pass 2nd-order Butterworth IIR low-pass filter (fc = 6.0 Hz for IMU, 8.0 Hz for FSR) eliminating phase lag.',
                output: 'Smooth, physiologically plausible joint velocity curves with high-frequency noise suppressed.'
            },
            'stage-sync': {
                title: 'Stage 4: Master Timeline Alignment & Timestamp Synchronization',
                input: 'Asynchronous streams: Camera (30 FPS), IMUs (100 Hz), FSRs (100 Hz).',
                process: 'Linear interpolation alignment to the master 100 Hz hardware timestamp clock with < 1.8 ms clock jitter.',
                output: 'Uniform synchronized multidimensional time series tensor.'
            },
            'stage-quality': {
                title: 'Stage 5: Data Integrity & Missing Frame Quality Check',
                input: 'Synchronized multi-channel time series buffer.',
                process: 'Scans for missing packets, unphysiological spike discontinuities, and computes estimated SNR (> 28 dB).',
                output: 'Verified Data Quality Certificate (PASS) with 0.00% sample drop rate.'
            },
            'stage-segmentation': {
                title: 'Stage 6: Biomechanical Gait Cycle Event Segmentation',
                input: 'Conditioned Shank Gyroscope Z-Pitch and FSR Heel/Hallux loading signals.',
                process: 'Fused event detection identifying Initial Contact (Heel Strike), Flat Foot, Toe-Off, and Mid-Swing.',
                output: 'Discrete normalized 0–100% gait cycles with stance/swing phase ratios and cadence.'
            }
        };

        const s = stages[stageId] || stages['stage-raw'];
        container.innerHTML = `
            <h3 class="card-title mb-2">${s.title}</h3>
            <div class="grid grid-3 mt-3">
                <div class="content-card">
                    <h4 class="subcard-title text-muted">INPUT DATA</h4>
                    <p class="text-sm">${s.input}</p>
                </div>
                <div class="content-card">
                    <h4 class="subcard-title text-primary">PROCESSING TRANSFORMATION</h4>
                    <p class="text-sm">${s.process}</p>
                </div>
                <div class="content-card">
                    <h4 class="subcard-title text-success">OUTPUT ARTIFACT</h4>
                    <p class="text-sm">${s.output}</p>
                </div>
            </div>
        `;
    }

    _populateResearchView() {
        const suppList = document.getElementById('research-supports-list');
        if (suppList) {
            suppList.innerHTML = RESEARCH_EVIDENCE.insights.supports.map(item => `<li>${item}</li>`).join('');
        }
        const notList = document.getElementById('research-notprove-list');
        if (notList) {
            notList.innerHTML = RESEARCH_EVIDENCE.insights.doesNotProve.map(item => `<li>${item}</li>`).join('');
        }

        const studiesGrid = document.getElementById('research-studies-grid');
        if (studiesGrid) {
            let html = '';
            RESEARCH_EVIDENCE.studies.forEach(s => {
                html += `
                    <div class="study-card">
                        <div class="study-title">${s.title}</div>
                        <div class="study-meta">${s.authors} (${s.year}) • ${s.domain}</div>
                        <div class="study-body"><strong>Relevance:</strong> ${s.whatItSupports}</div>
                        <div class="study-limit"><strong>Limitation:</strong> ${s.keyLimitation}</div>
                        <div class="footnote mt-2"><a href="${s.url}" target="_blank" rel="noopener noreferrer">DOI: ${s.doi}</a> • <em>${s.publishedNote}</em></div>
                    </div>
                `;
            });
            studiesGrid.innerHTML = html;
        }
    }

    _populateValidationView() {
        const container = document.getElementById('validation-stages-container');
        if (container) {
            let html = '<div class="grid grid-2">';
            VALIDATION_FRAMEWORK.stages.forEach(st => {
                const isCurrent = st.stageNumber === 3;
                html += `
                    <div class="content-card ${isCurrent ? 'border-left-primary' : ''}">
                        <div class="card-header">
                            <h4 class="card-title">STAGE ${st.stageNumber}: ${st.name}</h4>
                            <span class="badge ${st.status.includes('COMPLETED') ? 'badge-success' : isCurrent ? 'badge-warning' : 'badge-secondary'}">${st.status}</span>
                        </div>
                        <ul class="text-xs text-muted mb-2">
                            ${st.objectives.map(o => `<li>${o}</li>`).join('')}
                        </ul>
                        ${st.criticalCaution ? `<div class="alert-box alert-warning mt-2 text-xs">⚠️ ${st.criticalCaution}</div>` : ''}
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        }

        const limContainer = document.getElementById('validation-limitations-container');
        if (limContainer) {
            let html = '';
            VALIDATION_FRAMEWORK.limitations.forEach(lim => {
                html += `
                    <div class="content-card">
                        <h4 class="subcard-title">${lim.category}</h4>
                        <ul class="text-xs text-muted">
                            ${lim.points.map(p => `<li class="mb-2">${p}</li>`).join('')}
                        </ul>
                    </div>
                `;
            });
            limContainer.innerHTML = html;
        }
    }

    /* -------------------------------------------------------------
       UI EVENT BINDINGS
       ------------------------------------------------------------- */

    _bindUIEvents() {
        // Navigation View Switching
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');

                const targetViewId = item.getAttribute('data-view');
                document.querySelectorAll('.view-panel').forEach(v => v.classList.remove('active'));
                const targetView = document.getElementById(targetViewId);
                if (targetView) targetView.classList.add('active');
            });
        });

        // Interactive Pipeline Node Click
        document.querySelectorAll('.pipeline-node').forEach(node => {
            node.addEventListener('click', () => {
                const targetView = node.getAttribute('data-target-view');
                const btn = document.querySelector(`.nav-item[data-view="${targetView}"]`);
                if (btn) btn.click();
            });
        });

        // Intake Sliders
        const bindSlider = (idSlider, idVal) => {
            const el = document.getElementById(idSlider);
            const valEl = document.getElementById(idVal);
            if (el && valEl) {
                el.addEventListener('input', (e) => {
                    valEl.innerText = e.target.value;
                });
            }
        };
        bindSlider('intake-pain', 'val-pain');
        bindSlider('intake-stiffness', 'val-stiffness');
        bindSlider('intake-walking', 'val-walking');
        bindSlider('intake-stairs', 'val-stairs');

        // Start Screening Button
        const btnStart = document.getElementById('btn-start-screening');
        if (btnStart) {
            btnStart.addEventListener('click', async () => {
                const sId = document.getElementById('intake-session-id').value;
                const age = Number(document.getElementById('intake-age').value);
                const sex = document.getElementById('intake-sex').value;
                const pain = Number(document.getElementById('intake-pain').value);
                const stiffness = Number(document.getElementById('intake-stiffness').value);
                const pattern = document.getElementById('intake-pattern').value;

                await this.loadDemoIntake({ sessionId: sId, age, sex, pain, stiffness, pattern });
                await this.runSensorAcquisition();
                this.runCalibration();
                this.runFiltering();
                this.runSynchronization();
                this.runQualityCheck();
                this.runSegmentation();
                this.runFeatureExtraction();
                this.runInference();
                this.generateReport();

                // Switch to Sensor Monitor view
                const nav = document.getElementById('nav-sensor-monitor');
                if (nav) nav.click();
            });
        }

        // Regenerate Signals
        const btnReacquire = document.getElementById('btn-reacquire-signals');
        if (btnReacquire) {
            btnReacquire.addEventListener('click', () => {
                this.runSensorAcquisition();
            });
        }

        // DSP Pipeline Stage Tabs
        document.querySelectorAll('.dsp-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.dsp-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const stageId = tab.getAttribute('data-dsp-stage');
                this._renderDSPStage(stageId);
            });
        });

        // Extract Features Button
        const btnFeat = document.getElementById('btn-extract-features');
        if (btnFeat) {
            btnFeat.addEventListener('click', () => {
                this.runFeatureExtraction();
            });
        }

        // Train RF Button
        const btnTrainRf = document.getElementById('btn-train-rf');
        if (btnTrainRf) {
            btnTrainRf.addEventListener('click', async () => {
                await this.trainRandomForest();
                this.evaluateModels();
            });
        }

        // Train GB Button
        const btnTrainGb = document.getElementById('btn-train-gb');
        if (btnTrainGb) {
            btnTrainGb.addEventListener('click', async () => {
                await this.trainGradientBoosting();
                this.evaluateModels();
            });
        }

        // Train All Models Button
        const btnTrainAll = document.getElementById('btn-train-all-models');
        if (btnTrainAll) {
            btnTrainAll.addEventListener('click', async () => {
                await this.trainRandomForest();
                await this.trainGradientBoosting();
                this.evaluateModels();
            });
        }

        // Regenerate Dataset Button
        const btnRegenDs = document.getElementById('btn-regen-dataset');
        if (btnRegenDs) {
            btnRegenDs.addEventListener('click', async () => {
                await this.generateDataset();
                this.splitDataset();
                await this.trainRandomForest();
                await this.trainGradientBoosting();
                this.evaluateModels();
            });
        }

        // Model Selection Radio Cards
        document.querySelectorAll('input[name="model-select"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.querySelectorAll('.model-radio-card').forEach(c => c.classList.remove('active'));
                e.target.closest('.model-radio-card').classList.add('active');
                this.inferenceEngine.setModelSelection(e.target.value);
                const topModel = document.getElementById('top-active-model');
                if (topModel) {
                    topModel.innerText = e.target.value === 'randomForest' ? 'Random Forest' : e.target.value === 'gradientBoosting' ? 'Gradient Boosting' : 'Ensemble (RF+GB)';
                }
                this.runInference();
            });
        });

        // Execute Inference Button
        const btnInfer = document.getElementById('btn-run-inference');
        if (btnInfer) {
            btnInfer.addEventListener('click', () => {
                this.runInference();
            });
        }

        // Save Report Button
        const btnSave = document.getElementById('btn-save-report');
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                this.saveSession();
                alert(`Screening session ${this.state.sessionInfo.sessionId} saved to local storage.`);
            });
        }

        // Print Report Button
        const btnPrint = document.getElementById('btn-print-report');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                this.reportGenerator.printReport();
            });
        }

        // Clear Sessions Button
        const btnClear = document.getElementById('btn-clear-sessions');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                if (confirm('Clear all saved screening records from local storage?')) {
                    this.storageManager.clearSessions();
                    this._renderSavedSessions();
                }
            });
        }

        // Toggle Presentation Mode
        const btnPres = document.getElementById('btn-toggle-presentation');
        if (btnPres) {
            btnPres.addEventListener('click', () => {
                this.ui.togglePresentationMode();
            });
        }

        const btnPresExit = document.getElementById('btn-pres-exit');
        if (btnPresExit) {
            btnPresExit.addEventListener('click', () => {
                this.ui.togglePresentationMode(false);
            });
        }

        const btnPresNext = document.getElementById('btn-pres-next');
        if (btnPresNext) {
            btnPresNext.addEventListener('click', () => {
                this.ui.nextPresentationSlide();
            });
        }

        const btnPresPrev = document.getElementById('btn-pres-prev');
        if (btnPresPrev) {
            btnPresPrev.addEventListener('click', () => {
                this.ui.prevPresentationSlide();
            });
        }

        // Run Full Automated Demo
        const btnFullDemo = document.getElementById('btn-run-full-demo');
        if (btnFullDemo) {
            btnFullDemo.addEventListener('click', () => {
                this.ui.startFullDemo(this);
            });
        }

        const btnOverviewQuick = document.getElementById('btn-overview-quickstart');
        if (btnOverviewQuick) {
            btnOverviewQuick.addEventListener('click', () => {
                this.ui.startFullDemo(this);
            });
        }

        const btnDemoAbort = document.getElementById('btn-demo-abort');
        if (btnDemoAbort) {
            btnDemoAbort.addEventListener('click', () => {
                this.ui.stopFullDemo();
            });
        }
    }
}

// Instantiate and launch on DOM load
window.addEventListener('DOMContentLoaded', () => {
    const app = new AppController();
    window.gaitmatrixApp = app;
    app.init();
});
