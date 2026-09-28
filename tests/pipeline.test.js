import { SignalPreprocessor } from '../modules/preprocessing.js';
import { GaitSegmenter } from '../modules/segmentation.js';
import { FeatureEngine } from '../modules/features.js';
import { DatasetManager } from '../modules/dataset.js';
import { RandomForestClassifier } from '../modules/randomForest.js';
import { GradientBoostingClassifier } from '../modules/gradientBoosting.js';
import { MetricsEvaluator } from '../modules/metrics.js';
import { InferenceEngine } from '../modules/inference.js';
import { HardwareAdapter } from '../modules/simulation.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
    total++;
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        throw new Error(message);
    } else {
        passed++;
        console.log(`✅ PASS: ${message}`);
    }
}

console.log("==========================================");
console.log("   OA-SENSE SYSTEM VALIDATION TEST SUITE  ");
console.log("==========================================");

// TEST 1: Hardware Simulator & Signal Preprocessing Pipeline
try {
    const hw = new HardwareAdapter();
    const rawTrial = hw.acquireStream(6.0, 'restricted_flexion', { age: 62, pain: 6 });
    assert(rawTrial && rawTrial.metadata.totalSamples === 600, `Hardware simulator generated 600 samples @ 100Hz (samples = ${rawTrial.metadata.totalSamples})`);

    const preprocessor = new SignalPreprocessor();
    const calibrated = preprocessor.calibrate(rawTrial);
    assert(calibrated && calibrated.imu.leftShank.gz.length === 600, "Calibration baseline tare succeeded");

    const filtered = preprocessor.filterTrialData(calibrated);
    assert(filtered && filtered.imu.leftShank.gz.length === 600, "Butterworth zero-phase 6Hz lowpass filtering succeeded");

    const synced = preprocessor.synchronizeStreams(filtered);
    assert(synced && synced.syncMetadata.sampleCount === 600, "Master 100Hz synchronization alignment succeeded (600 samples)");

    const qc = preprocessor.performQualityCheck(synced);
    assert(qc.status === 'PASS', `Signal quality check passed (SNR = ${qc.estimatedSnrDb} dB, missing = ${qc.missingSamples})`);
} catch (e) {
    console.error("Test 1 failed:", e);
    process.exit(1);
}

// TEST 2: Gait Segmentation (Adaptive Initial Contact & Stance/Swing)
let syncedTrialRef = null;
let segResultRef = null;
try {
    const hw = new HardwareAdapter();
    const rawTrial = hw.acquireStream(6.0, 'normal', { age: 45, pain: 2 });
    const preprocessor = new SignalPreprocessor();
    const synced = preprocessor.synchronizeStreams(preprocessor.filterTrialData(preprocessor.calibrate(rawTrial)));
    syncedTrialRef = synced;

    const segmenter = new GaitSegmenter(100);
    const segResult = segmenter.segmentTrial(synced);
    segResultRef = segResult;
    
    assert(segResult.leftEvents.initialContacts.length > 0, `Detected ${segResult.leftEvents.initialContacts.length} left Initial Contacts (IC)`);
    assert(segResult.rightEvents.initialContacts.length > 0, `Detected ${segResult.rightEvents.initialContacts.length} right Initial Contacts (IC)`);
    assert(segResult.leftCycles.length > 0, `Segmented ${segResult.leftCycles.length} complete left gait cycles`);
    assert(typeof segResult.temporalSummary.cadenceStepsPerMin === 'number', `Computed cadence: ${segResult.temporalSummary.cadenceStepsPerMin} steps/min`);
} catch (e) {
    console.error("Test 2 failed:", e);
    process.exit(1);
}

// TEST 3: Multimodal 12-Dimensional Feature Engineering
let featureVectorRef = null;
try {
    const featureEngine = new FeatureEngine();
    const extracted = featureEngine.extractFeatures(syncedTrialRef, segResultRef, { age: 56, pain: 5, stiffness: 4, bmi: 26.8 });
    featureVectorRef = extracted.featureVector;

    assert(Array.isArray(extracted.featureVector), "Feature vector is an array");
    assert(extracted.featureVector.length === 12, `12-D Multimodal feature vector extracted (length = ${extracted.featureVector.length})`);
    assert(typeof extracted.featureDict.knee_rom === 'number', `Knee ROM: ${extracted.featureDict.knee_rom.toFixed(1)}°`);
    assert(typeof extracted.featureDict.loading_asymmetry === 'number', `Plantar loading asymmetry: ${extracted.featureDict.loading_asymmetry.toFixed(3)}`);
} catch (e) {
    console.error("Test 3 failed:", e);
    process.exit(1);
}

// TEST 4: Seeded Synthetic Dataset & Zero-Leakage Participant Split
let splitRef = null;
try {
    const datasetManager = new DatasetManager(777);
    const dataset = datasetManager.generateSyntheticDataset(40, 6);
    assert(dataset.metadata.totalSamples === 240, `Generated dataset of ${dataset.metadata.totalSamples} trials across ${dataset.metadata.totalParticipants} participants`);

    const split = datasetManager.splitByParticipant(0.70, 0.15, 0.15);
    splitRef = split;
    assert(split.overlapCheck.trainValOverlap === 0, "Zero participant leakage between Train & Val sets");
    assert(split.overlapCheck.trainTestOverlap === 0, "Zero participant leakage between Train & Test sets");
    assert(split.overlapCheck.valTestOverlap === 0, "Zero participant leakage between Val & Test sets");
    assert(split.train.X.length > 0 && split.train.y.length === split.train.X.length, `Train set formatted (${split.train.sampleCount} samples)`);
} catch (e) {
    console.error("Test 4 failed:", e);
    process.exit(1);
}

// TEST 5: Random Forest Classifier (25 Trees)
const rf = new RandomForestClassifier(25, 6, 4, 3);
try {
    const trainResult = rf.fit(splitRef.train.X, splitRef.train.y);
    assert(rf.isTrained === true, "Random Forest classifier trained successfully");
    assert(rf.trees.length === 25, `25 Decision trees constructed`);

    const sample = splitRef.test.X[0];
    const probs = rf.predictProbabilities(sample);
    assert(Array.isArray(probs) && probs.length === 3, "Random Forest outputted 3-class probability distribution");
    const sum = probs.reduce((a, b) => a + b, 0);
    assert(Math.abs(sum - 1.0) < 0.01, `Probabilities sum to 1.0 (actual: ${sum.toFixed(4)})`);

    const predClass = rf.predict(sample);
    assert([0, 1, 2].includes(predClass), `Predicted class index valid: ${predClass}`);
} catch (e) {
    console.error("Test 5 failed:", e);
    process.exit(1);
}

// TEST 6: Gradient Boosted Trees Classifier (20 Estimators)
const gb = new GradientBoostingClassifier(20, 0.10, 3, 3);
try {
    const trainResult = gb.fit(splitRef.train.X, splitRef.train.y, splitRef.val.X, splitRef.val.y);
    assert(gb.isTrained === true, "Gradient Boosted classifier trained successfully");
    assert(gb.trees.length === 20, `20 Boosting stage estimators constructed`);

    const sample = splitRef.test.X[0];
    const probs = gb.predictProbabilities(sample);
    assert(Array.isArray(probs) && probs.length === 3, "GBDT outputted 3-class probability distribution");
    const sum = probs.reduce((a, b) => a + b, 0);
    assert(Math.abs(sum - 1.0) < 0.01, `GBDT probabilities sum to 1.0 (actual: ${sum.toFixed(4)})`);

    const predClass = gb.predict(sample);
    assert([0, 1, 2].includes(predClass), `GBDT predicted class index valid: ${predClass}`);
} catch (e) {
    console.error("Test 6 failed:", e);
    process.exit(1);
}

// TEST 7: Metrics Evaluation & Multi-Class Confusion Matrix
try {
    const evaluator = new MetricsEvaluator(['LOW', 'MODERATE', 'ELEVATED']);
    const testPredictions = rf.predictBatch(splitRef.test.X);
    const metrics = evaluator.evaluate(splitRef.test.y, testPredictions);

    assert(typeof metrics.accuracy === 'number' && metrics.accuracy >= 0.70, `Test Accuracy computed: ${(metrics.accuracy * 100).toFixed(1)}% (>= 70%)`);
    assert(typeof metrics.macro.f1 === 'number' && metrics.macro.f1 >= 0, `Macro F1 Score computed: ${(metrics.macro.f1 * 100).toFixed(1)}%`);
    assert(Array.isArray(metrics.confusionMatrix) && metrics.confusionMatrix.length === 3, "3x3 Confusion matrix generated");
} catch (e) {
    console.error("Test 7 failed:", e);
    process.exit(1);
}

// TEST 8: Explainable AI Inference & Risk Tiering
try {
    const datasetManager = new DatasetManager(777);
    const inference = new InferenceEngine();
    inference.setModelSelection('ensemble');

    const result = inference.predict(featureVectorRef, rf, gb, datasetManager.featureNames);
    assert(['LOW', 'MODERATE', 'ELEVATED'].includes(result.screeningCategory), `Inference returned valid risk tier: ${result.screeningCategory}`);
    assert(typeof result.confidence === 'number' && result.confidence >= 0 && result.confidence <= 100, `Confidence score computed: ${result.confidence}%`);
    assert(result.explainability.allFeatures.length === 12, `Computed feature attributions for all 12 dimensions`);
    assert(result.explainability.topContributors.length === 5, `Extracted top 5 explainable risk contributors`);
    assert(typeof result.clinicalDisclaimer === 'string' && result.clinicalDisclaimer.length > 10, "Clinical disclaimer attached");
} catch (e) {
    console.error("Test 8 failed:", e);
    process.exit(1);
}

console.log("==========================================");
console.log(`TEST SUMMARY: ALL ${passed} / ${total} ASSERTIONS PASSED! (100%)`);
console.log("==========================================");
