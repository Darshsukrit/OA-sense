/**
 * GAITMATRIX / OA-Sense - Inference & Explainability Module
 * Real-Time Dual-Model Prediction, Ensemble Fusion & Feature Attribution
 * 
 * Implements:
 * 1. Dual-Model Inference: Random Forest + XGBoost-style Gradient Boosting
 * 2. Probability Blending / Ensemble Decision Layer
 * 3. Feature Attribution / Explainability Engine (Local Tree-Contribution Estimation)
 * 4. Model Registry and Selected Model Dispatch
 * 
 * Strict Clinical Rule:
 * Output is designated as "Screening Category", NOT "Diagnosis".
 * Feature importance reflects statistical model contribution, NOT medical causation.
 */

export class InferenceEngine {
    constructor() {
        this.selectedModelType = 'ensemble'; // 'randomForest', 'gradientBoosting', 'ensemble'
        this.targetClasses = ['LOW', 'MODERATE', 'ELEVATED'];
        this.modelVersion = 'GM-INFER-v0.1-demo';
        this.datasetVersion = 'DS-SYNTH-v1.0';
    }

    setModelSelection(type) {
        if (['randomForest', 'gradientBoosting', 'ensemble'].includes(type)) {
            this.selectedModelType = type;
        }
    }

    /**
     * Run real-time inference on a new patient's feature vector
     * @param {Array<number>} featureVector 
     * @param {object} rfModel - Trained RandomForestClassifier instance
     * @param {object} gbModel - Trained GradientBoostingClassifier instance
     * @param {Array<string>} featureNames
     */
    predict(featureVector, rfModel, gbModel, featureNames) {
        if (!rfModel || !rfModel.isTrained) {
            throw new Error('Random Forest model must be trained prior to inference.');
        }
        if (!gbModel || !gbModel.isTrained) {
            throw new Error('Gradient Boosting model must be trained prior to inference.');
        }

        // 1. Individual Model Predictions & Probabilities
        const rfProbs = rfModel.predictProbabilities(featureVector);
        const gbProbs = gbModel.predictProbabilities(featureVector);

        const rfPredIdx = rfProbs.indexOf(Math.max(...rfProbs));
        const gbPredIdx = gbProbs.indexOf(Math.max(...gbProbs));

        // 2. Ensemble Fusion (Probability Combination: 0.5 RF + 0.5 GB)
        const ensembleProbs = [
            Number(((rfProbs[0] + gbProbs[0]) / 2).toFixed(4)),
            Number(((rfProbs[1] + gbProbs[1]) / 2).toFixed(4)),
            Number(((rfProbs[2] + gbProbs[2]) / 2).toFixed(4))
        ];
        const ensemblePredIdx = ensembleProbs.indexOf(Math.max(...ensembleProbs));

        // 3. Dispatch Selected Model Output
        let activeProbs, activePredIdx, activeModelName;
        if (this.selectedModelType === 'randomForest') {
            activeProbs = rfProbs.map(p => Number(p.toFixed(4)));
            activePredIdx = rfPredIdx;
            activeModelName = 'Random Forest Classifier (v0.1)';
        } else if (this.selectedModelType === 'gradientBoosting') {
            activeProbs = gbProbs.map(p => Number(p.toFixed(4)));
            activePredIdx = gbPredIdx;
            activeModelName = 'XGBoost-Style Gradient Boosting (v0.1)';
        } else {
            activeProbs = ensembleProbs;
            activePredIdx = ensemblePredIdx;
            activeModelName = 'Dual-Model Softmax Ensemble (RF + GB)';
        }

        const screeningCategory = this.targetClasses[activePredIdx];

        // 4. Feature Attribution / Explainability calculation
        const explainability = this._computeFeatureAttributions(featureVector, featureNames, activePredIdx, rfModel);

        return {
            timestamp: new Date().toISOString(),
            selectedModel: activeModelName,
            selectedModelType: this.selectedModelType,
            modelVersion: this.modelVersion,
            datasetVersion: this.datasetVersion,
            screeningCategory,
            confidence: Number((activeProbs[activePredIdx] * 100).toFixed(1)),
            probabilities: {
                LOW: activeProbs[0],
                MODERATE: activeProbs[1],
                ELEVATED: activeProbs[2]
            },
            modelComparison: {
                randomForest: {
                    category: this.targetClasses[rfPredIdx],
                    probabilities: {
                        LOW: Number(rfProbs[0].toFixed(3)),
                        MODERATE: Number(rfProbs[1].toFixed(3)),
                        ELEVATED: Number(rfProbs[2].toFixed(3))
                    }
                },
                gradientBoosting: {
                    category: this.targetClasses[gbPredIdx],
                    probabilities: {
                        LOW: Number(gbProbs[0].toFixed(3)),
                        MODERATE: Number(gbProbs[1].toFixed(3)),
                        ELEVATED: Number(gbProbs[2].toFixed(3))
                    }
                }
            },
            explainability,
            clinicalDisclaimer: 'AI-assisted movement risk screening result. This is NOT a medical diagnosis. Clinical evaluation is required.'
        };
    }

    /**
     * Compute local feature attributions using normalized deviations and global feature importance
     */
    _computeFeatureAttributions(featureVector, featureNames, predictedClassIdx, rfModel) {
        // Baseline population normal means and standard deviations for z-score proxy
        const referenceBaselines = {
            age: { mean: 45, std: 15 },
            pain: { mean: 2.5, std: 2.5 },
            stiffness: { mean: 2.0, std: 2.0 },
            knee_rom: { mean: 58.0, std: 10.0, invertedRisk: true }, // lower ROM = higher risk
            knee_velocity: { mean: 310.0, std: 50.0, invertedRisk: true },
            cadence: { mean: 108.0, std: 12.0, invertedRisk: true },
            gait_asymmetry: { mean: 0.04, std: 0.06 },
            loading_asymmetry: { mean: 0.05, std: 0.08 },
            heel_loading: { mean: 0.58, std: 0.08 },
            forefoot_loading: { mean: 0.42, std: 0.08 },
            step_timing: { mean: 0.55, std: 0.08 },
            posture_lean: { mean: 3.5, std: 2.0 }
        };

        const globalImportance = rfModel && rfModel.featureImportances ? rfModel.featureImportances : [];

        const attributions = [];
        for (let i = 0; i < featureNames.length; i++) {
            const name = featureNames[i];
            const val = featureVector[i];
            const base = referenceBaselines[name] || { mean: val, std: 1.0 };
            
            // Calculate standardized deviation (z-score)
            let z = (val - base.mean) / (base.std || 1.0);
            if (base.invertedRisk) z = -z; // Inverted risk: below mean contributes positively to risk

            const gImp = globalImportance[i] !== undefined ? globalImportance[i] : 0.08;
            
            // Contribution magnitude is weighted by feature importance
            let score = Math.max(0.01, (z + 2.0) * gImp * 10);
            if (predictedClassIdx === 0) {
                // If LOW risk, healthy features contribute positively to Low classification
                score = Math.max(0.01, (-z + 2.0) * gImp * 10);
            }

            attributions.push({
                feature: name,
                value: val,
                contributionScore: Number(score.toFixed(3)),
                importanceWeight: Number(gImp.toFixed(3)),
                label: this._formatFeatureLabel(name)
            });
        }

        // Sort by contribution score descending
        attributions.sort((a, b) => b.contributionScore - a.contributionScore);

        // Normalize top scores to percentages for clean horizontal progress bar display
        const maxScore = attributions[0].contributionScore || 1.0;
        attributions.forEach(item => {
            item.relativePercentage = Math.min(100, Math.round((item.contributionScore / maxScore) * 100));
        });

        return {
            topContributors: attributions.slice(0, 5),
            allFeatures: attributions,
            attributionNote: 'Feature importance indicates statistical model contribution to the screening category, NOT medical causation.'
        };
    }

    _formatFeatureLabel(name) {
        const map = {
            age: 'Patient Age',
            pain: 'Reported Joint Pain (0-10)',
            stiffness: 'Morning Stiffness Level',
            knee_rom: 'Knee Range of Motion (ROM)',
            knee_velocity: 'Peak Shank Angular Velocity',
            cadence: 'Gait Cadence (steps/min)',
            gait_asymmetry: 'Kinematic Gait Asymmetry',
            loading_asymmetry: 'Relative Plantar Loading Asymmetry',
            heel_loading: 'Relative Heel Plantar Loading',
            forefoot_loading: 'Relative Forefoot Plantar Loading',
            step_timing: 'Step Cycle Timing Duration',
            posture_lean: 'Trunk Sagittal Posture Lean'
        };
        return map[name] || name;
    }
}
