/**
 * GAITMATRIX / OA-Sense - Gradient Boosting Module
 * Pure Client-Side Machine Learning: XGBoost-Style Multi-Class Gradient Boosting
 * 
 * Implements:
 * 1. Multi-class Softmax probability estimation
 * 2. Pseudo-residuals (negative gradient of Cross-Entropy loss: r_ik = y_ik - p_ik)
 * 3. Sequential weak regression trees fit to residuals per class
 * 4. Shrinkage / Learning Rate (eta) regularized boosting updates
 * 5. Iteration-by-iteration training and validation loss tracking
 * 
 * Note: Named "XGBoost-style Gradient Boosting" for educational/research demonstration.
 * This is an offline JavaScript implementation, NOT the official C++ XGBoost library.
 */

class WeakRegressionTreeNode {
    constructor() {
        this.featureIndex = null;
        this.threshold = null;
        this.left = null;
        this.right = null;
        this.isLeaf = false;
        this.value = 0.0; // Terminal leaf output value
    }
}

class WeakRegressionTree {
    constructor(maxDepth = 3, minSamplesSplit = 4) {
        this.maxDepth = maxDepth;
        this.minSamplesSplit = minSamplesSplit;
        this.root = null;
    }

    _buildTree(X, residuals, depth) {
        const node = new WeakRegressionTreeNode();
        const meanResidual = residuals.reduce((a, b) => a + b, 0) / (residuals.length || 1);
        node.value = meanResidual;

        if (depth >= this.maxDepth || residuals.length < this.minSamplesSplit) {
            node.isLeaf = true;
            return node;
        }

        const numFeatures = X[0].length;
        let bestVarReduction = -1;
        let bestFeature = null;
        let bestThreshold = null;
        let bestLeftIdxs = null;
        let bestRightIdxs = null;

        const currentVariance = this._variance(residuals);

        for (let featIdx = 0; featIdx < numFeatures; featIdx++) {
            const values = X.map(row => row[featIdx]);
            const sortedVals = [...new Set(values)].sort((a, b) => a - b);
            const step = Math.max(1, Math.floor(sortedVals.length / 8));

            for (let i = 0; i < sortedVals.length - 1; i += step) {
                const thresh = (sortedVals[i] + sortedVals[i + 1]) / 2;
                const leftIdxs = [];
                const rightIdxs = [];

                for (let k = 0; k < X.length; k++) {
                    if (X[k][featIdx] <= thresh) leftIdxs.push(k);
                    else rightIdxs.push(k);
                }

                if (leftIdxs.length === 0 || rightIdxs.length === 0) continue;

                const leftRes = leftIdxs.map(k => residuals[k]);
                const rightRes = rightIdxs.map(k => residuals[k]);

                const varLeft = this._variance(leftRes);
                const varRight = this._variance(rightRes);
                const weightedVar = (leftRes.length / residuals.length) * varLeft + (rightRes.length / residuals.length) * varRight;
                const reduction = currentVariance - weightedVar;

                if (reduction > bestVarReduction) {
                    bestVarReduction = reduction;
                    bestFeature = featIdx;
                    bestThreshold = thresh;
                    bestLeftIdxs = leftIdxs;
                    bestRightIdxs = rightIdxs;
                }
            }
        }

        if (bestVarReduction <= 1e-5 || !bestLeftIdxs || !bestRightIdxs) {
            node.isLeaf = true;
            return node;
        }

        node.featureIndex = bestFeature;
        node.threshold = bestThreshold;

        const leftX = bestLeftIdxs.map(k => X[k]);
        const leftRes = bestLeftIdxs.map(k => residuals[k]);
        const rightX = bestRightIdxs.map(k => X[k]);
        const rightRes = bestRightIdxs.map(k => residuals[k]);

        node.left = this._buildTree(leftX, leftRes, depth + 1);
        node.right = this._buildTree(rightX, rightRes, depth + 1);

        return node;
    }

    _variance(arr) {
        if (arr.length <= 1) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        return arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length;
    }

    fit(X, residuals) {
        this.root = this._buildTree(X, residuals, 0);
    }

    predictSample(sample, node = this.root) {
        if (!node || node.isLeaf || node.featureIndex === null) {
            return node ? node.value : 0;
        }
        if (sample[node.featureIndex] <= node.threshold) {
            return this.predictSample(sample, node.left);
        } else {
            return this.predictSample(sample, node.right);
        }
    }
}

export class GradientBoostingClassifier {
    constructor(numEstimators = 20, learningRate = 0.1, maxDepth = 3, numClasses = 3) {
        this.numEstimators = numEstimators;
        this.learningRate = learningRate;
        this.maxDepth = maxDepth;
        this.numClasses = numClasses;
        this.baseLogOdds = []; // Initial prior log-odds per class
        this.trees = [];       // Matrix of trees: [estimator_m][class_c]
        this.trainLossHistory = [];
        this.valLossHistory = [];
        this.isTrained = false;
        this.modelVersion = 'GB-v0.1-demo';
    }

    /**
     * Compute multi-class softmax probabilities from raw log-odds (logits)
     */
    _softmax(logits) {
        const maxLogit = Math.max(...logits);
        const exp = logits.map(l => Math.exp(l - maxLogit));
        const sumExp = exp.reduce((a, b) => a + b, 0) || 1e-6;
        return exp.map(e => e / sumExp);
    }

    /**
     * Cross-entropy multi-class loss
     */
    _crossEntropyLoss(yTrue, probs) {
        let loss = 0;
        for (let i = 0; i < yTrue.length; i++) {
            const trueClass = yTrue[i];
            const p = Math.max(1e-12, Math.min(1 - 1e-12, probs[i][trueClass]));
            loss -= Math.log(p);
        }
        return loss / (yTrue.length || 1);
    }

    /**
     * Fit Gradient Boosted trees sequentially
     */
    async fit(X_train, y_train, X_val = null, y_val = null, onProgress = null) {
        const nSamples = X_train.length;
        this.trees = [];
        this.trainLossHistory = [];
        this.valLossHistory = [];

        // 1. Initialize prior log-odds (base prediction) for each class
        const classCounts = new Array(this.numClasses).fill(0);
        for (let i = 0; i < nSamples; i++) classCounts[y_train[i]]++;
        this.baseLogOdds = classCounts.map(c => Math.log((c / nSamples) || 1e-4));

        // Initialize score matrices F_i,k
        const F_train = Array.from({ length: nSamples }, () => [...this.baseLogOdds]);
        const F_val = X_val ? Array.from({ length: X_val.length }, () => [...this.baseLogOdds]) : null;

        // One-hot encode targets
        const Y_onehot = Array.from({ length: nSamples }, (_, i) => {
            const row = new Array(this.numClasses).fill(0);
            row[y_train[i]] = 1;
            return row;
        });

        for (let m = 0; m < this.numEstimators; m++) {
            const treesForIteration = [];

            // Compute current probabilities for all training samples
            const currentTrainProbs = F_train.map(logits => this._softmax(logits));

            // Fit a regression tree for each class to predict pseudo-residuals: r_ik = y_ik - p_ik
            for (let c = 0; c < this.numClasses; c++) {
                const residuals = new Array(nSamples);
                for (let i = 0; i < nSamples; i++) {
                    residuals[i] = Y_onehot[i][c] - currentTrainProbs[i][c];
                }

                const tree = new WeakRegressionTree(this.maxDepth, 4);
                tree.fit(X_train, residuals);
                treesForIteration.push(tree);

                // Update training raw scores with shrinkage: F = F + eta * tree.predict()
                for (let i = 0; i < nSamples; i++) {
                    const update = tree.predictSample(X_train[i]);
                    F_train[i][c] += this.learningRate * update;
                }

                // Update validation raw scores if validation set provided
                if (X_val && F_val) {
                    for (let i = 0; i < X_val.length; i++) {
                        const update = tree.predictSample(X_val[i]);
                        F_val[i][c] += this.learningRate * update;
                    }
                }
            }

            this.trees.push(treesForIteration);

            // Compute and record iteration losses
            const updatedTrainProbs = F_train.map(logits => this._softmax(logits));
            const trainLoss = Number(this._crossEntropyLoss(y_train, updatedTrainProbs).toFixed(4));
            this.trainLossHistory.push(trainLoss);

            if (X_val && y_val && F_val) {
                const updatedValProbs = F_val.map(logits => this._softmax(logits));
                const valLoss = Number(this._crossEntropyLoss(y_val, updatedValProbs).toFixed(4));
                this.valLossHistory.push(valLoss);
            }

            const progress = Math.round(((m + 1) / this.numEstimators) * 100);
            if (onProgress) {
                onProgress(progress, m + 1, this.numEstimators, trainLoss);
                await new Promise(r => setTimeout(r, 12));
            }
        }

        this.isTrained = true;
        return {
            estimators: this.numEstimators,
            learningRate: this.learningRate,
            finalTrainLoss: this.trainLossHistory[this.trainLossHistory.length - 1],
            finalValLoss: this.valLossHistory.length > 0 ? this.valLossHistory[this.valLossHistory.length - 1] : null,
            status: 'TRAINED'
        };
    }

    /**
     * Compute raw logits and convert to class probabilities via Softmax
     */
    predictProbabilities(sample) {
        if (!this.isTrained) throw new Error('Gradient Boosting model is not trained yet.');

        const logits = [...this.baseLogOdds];

        for (let m = 0; m < this.trees.length; m++) {
            for (let c = 0; c < this.numClasses; c++) {
                const tree = this.trees[m][c];
                logits[c] += this.learningRate * tree.predictSample(sample);
            }
        }

        return this._softmax(logits);
    }

    predict(sample) {
        const probs = this.predictProbabilities(sample);
        return probs.indexOf(Math.max(...probs));
    }

    predictBatch(X) {
        return X.map(s => this.predict(s));
    }

    predictProbabilitiesBatch(X) {
        return X.map(s => this.predictProbabilities(s));
    }
}
